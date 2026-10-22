// 演出排程：把一局（record.spins 的事件序列）演成盤面動畫、HUD 更新與彈窗。
import { FREE_GAME, WIN_TIERS, JACKPOTS } from '../engine/config.js';
import { money } from '../engine/round.js';
import { wait, setSpeed } from '../render/tween.js';
import { fmt } from '../ui/format.js';

export class Sequencer {
  /**
   * @param {object} deps { board, hud, popups, scene, effects, characters, sfx, options }
   */
  constructor(deps) {
    Object.assign(this, deps);
    this.turbo = false;
    this.fast = false; // e2e：把所有等待縮到最短
    this.skipRequested = false;
    this.playing = false;
    this.trace = []; // 最近的演出步驟（除錯／驗收用）
  }

  mark(label) {
    this.trace.push([Math.round(performance.now()), label]);
    if (this.trace.length > 400) this.trace.shift();
  }

  get quick() {
    return this.turbo || this.fast || this.skipRequested;
  }

  pause(seconds) {
    if (this.fast) return wait(Math.min(seconds, 0.02));
    return wait(this.quick ? seconds * 0.35 : seconds);
  }

  setTurbo(on) {
    this.turbo = on;
    setSpeed(this.fast ? 6 : on ? 2.2 : 1);
  }

  setFast(on) {
    this.fast = on;
    setSpeed(on ? 6 : this.turbo ? 2.2 : 1);
  }

  // 玩家在掉落中再按一次旋轉：加速本轉。
  requestSkip() {
    if (!this.playing) return;
    this.skipRequested = true;
    setSpeed(6);
  }

  // 演出一整局。record 來自 LocalDemo.spin()。
  async play(record) {
    this.playing = true;
    this.skipRequested = false;
    const bet = record.bet;
    const hud = this.hud;
    let featureIntroShown = false;
    let roundTotal = 0; // 元
    let inFeature = false;
    let featureKind = null;
    hud.setWin(0);
    for (let s = 0; s < record.spins.length; s++) {
      const spin = record.spins[s];
      const isFeatureSpin = spin.mode !== 'base';
      if (isFeatureSpin && !featureIntroShown) {
        featureIntroShown = true;
        inFeature = true;
        featureKind = record.featureInfo?.kind ?? spin.mode;
        await this.enterFeature(record, featureKind, spin);
      }
      if (isFeatureSpin) hud.setFreeSpins(spin.spinsLeft + 0, spin.totalSpins, spin.spinsPlayed, record.featureInfo?.super);
      const spinWin = await this.playSpin(spin, bet, { inFeature, featureKind, record });
      roundTotal = money(roundTotal + spinWin);
      hud.setWin(roundTotal);
      if (isFeatureSpin && spin.multiplier > 0) hud.setTotalTimes(spin.multiplier);
      // 大獎橫幅：主遊戲以整局計；免費遊戲以單轉計
      const tierBase = isFeatureSpin ? spinWin : roundTotal;
      if (!isFeatureSpin && s === record.spins.length - 1) await this.maybeBigWin(tierBase, bet);
      else if (isFeatureSpin) await this.maybeBigWin(spinWin, bet);
      if (isFeatureSpin && s < record.spins.length - 1) await this.pause(0.55);
    }
    if (inFeature) await this.exitFeature(record, roundTotal, bet);
    this.board.hideWinText();
    this.board.restoreMaterials();
    this.playing = false;
    this.skipRequested = false;
    setSpeed(this.fast ? 6 : this.turbo ? 2.2 : 1);
    return roundTotal;
  }

  // 單轉：drop → (upgrade) → win/tumble… → multiply → scatterPay → jackpot → mystery → trigger/retrigger
  async playSpin(spin, bet, ctx) {
    const { board, hud } = this;
    let spinWinUnits = 0; // 以押注 1/100 計
    const toMoney = (u) => money((u * bet) / 100);
    const quick = () => this.quick;
    let cascadeIndex = 0;
    for (const ev of spin.events) {
      this.mark(`${spin.mode}:${ev.type}`);
      switch (ev.type) {
        case 'drop':
          if (spin.bought) {
            board.setBoard(ev.board);
            await this.pause(0.3);
          } else {
            this.sfx?.play('spin');
            this.characters?.onSpin?.();
            await board.drop(ev.board, ev.kept, { quick: quick() });
          }
          break;
        case 'upgrade':
          for (const o of ev.orbs) if (o.to !== o.from) await board.upgradeOrb(o.i, o.to, { quick: quick() });
          break;
        case 'win': {
          cascadeIndex++;
          const cells = ev.groups.flatMap((g) => g.cells);
          this.sfx?.play('win', cascadeIndex);
          spinWinUnits = ev.totalWin;
          hud.setWin(money((ctx.record.roundSoFar ?? 0) + toMoney(ev.totalWin)));
          this.characters?.onWin?.(cascadeIndex);
          await Promise.all([board.highlight(cells, { pulses: quick() ? 1 : 2, duration: quick() ? 0.18 : 0.3 }), board.showWinText(fmt(toMoney(ev.stepWin)))]);
          if (cascadeIndex >= 2) hud.cascadeSlogan(cascadeIndex);
          if (cells.length === 30) {
            this.sfx?.play('trigger');
            await this.popups.fullCombo({ fast: this.fast });
          }
          await board.remove(cells, { quick: quick() });
          board.hideWinText();
          break;
        }
        case 'tumble':
          board.restoreMaterials();
          await board.tumble(ev.moves, ev.added, { quick: quick() });
          break;
        case 'split':
          this.characters?.onSkill?.('set');
          await board.pulse(ev.totems, 2, { quick: quick() });
          this.sfx?.play('skill');
          hud.toast(`賽特分裂：倍數球複製 ×${ev.targets.length}`, 'skill');
          await board.split(ev.source, ev.targets, { quick: quick() });
          spinWinUnits += ev.win;
          break;
        case 'lock':
          this.characters?.onSkill?.('neph');
          await board.pulse(ev.totems, 2, { quick: quick() });
          this.sfx?.play('skill');
          hud.toast(`奈芙蒂斯鎖定：倍數球鎖定 ${ev.rounds} 回合`, 'skill');
          ev.orbs.forEach((i, k) => board.setLock(i, ev.locks[k]));
          await board.pulse(ev.orbs, 1, { quick: quick() });
          spinWinUnits += ev.win;
          break;
        case 'multiply': {
          board.restoreMaterials();
          const volley = this.characters?.onMultiply?.();
          await board.pulse(ev.orbs, quick() ? 1 : 2, { quick: quick() });
          if (volley && !this.fast) await volley;
          this.sfx?.play('multiply');
          const label = ctx.inFeature ? `${fmt(toMoney(ev.baseWin))} × ${ev.after}` : `${fmt(toMoney(ev.baseWin))} × ${ev.sum}`;
          await board.showWinText(label);
          if (ctx.inFeature) hud.setTotalTimes(ev.after, ev.before);
          await this.pause(0.6);
          await board.showWinText(fmt(toMoney(ev.win)));
          hud.setWin(money((ctx.record.roundSoFar ?? 0) + toMoney(ev.win)));
          spinWinUnits = ev.win;
          await this.pause(0.55);
          board.hideWinText();
          break;
        }
        case 'scatterPay':
          this.sfx?.play('scatter');
          await board.pulse(ev.cells, 2, { quick: quick() });
          spinWinUnits += ev.win;
          hud.setWin(money((ctx.record.roundSoFar ?? 0) + toMoney(spinWinUnits)));
          await board.showWinText(`SCATTER ${fmt(toMoney(ev.win))}`);
          await this.pause(0.6);
          board.hideWinText();
          break;
        case 'jackpot': {
          await board.pulse(ev.cells, 3, { quick: quick() });
          spinWinUnits += ev.win;
          this.scene.lightning(1);
          this.effects.coins(60);
          this.sfx?.play('jackpot');
          this.characters?.onBigWinStart?.();
          await this.popups.jackpot(JACKPOTS[ev.tier], toMoney(ev.win), { fast: this.fast });
          this.characters?.onBigWinEnd?.();
          hud.setWin(money((ctx.record.roundSoFar ?? 0) + toMoney(spinWinUnits)));
          break;
        }
        case 'mystery': {
          spinWinUnits += ev.win;
          this.sfx?.play('chest');
          await this.popups.mystery(toMoney(ev.win), ev.decoys.map(toMoney), { fast: this.fast });
          hud.setWin(money((ctx.record.roundSoFar ?? 0) + toMoney(spinWinUnits)));
          break;
        }
        case 'cap':
          spinWinUnits = ev.win;
          hud.toast('已達最高贏分 81,000 倍！', 'max');
          break;
        case 'trigger':
          this.characters?.onTrigger?.();
          await board.pulse(ev.cells, 3, { quick: quick() });
          this.scene.lightning(0.8);
          this.sfx?.play('trigger');
          ctx.record.pendingTrigger = ev;
          break;
        case 'retrigger':
          await board.pulse(ev.cells, 2, { quick: quick() });
          this.sfx?.play('trigger');
          hud.setFreeSpins(spin.spinsLeft, spin.totalSpins, spin.spinsPlayed, false);
          await this.popups.retrigger(ev.added, ev.total, { fast: this.fast });
          break;
        default:
          break;
      }
    }
    this.mark(`${spin.mode}:end`);
    const spinWin = toMoney(spin.win);
    ctx.record.roundSoFar = money((ctx.record.roundSoFar ?? 0) + spinWin);
    return spinWin;
  }

  async maybeBigWin(amount, bet) {
    const x = amount / bet;
    let tier = null;
    for (const t of WIN_TIERS) if (x >= t.x) tier = t;
    if (!tier) return;
    this.sfx?.play('bigwin', WIN_TIERS.indexOf(tier));
    this.characters?.onBigWinStart?.();
    this.effects.coins(30 + WIN_TIERS.indexOf(tier) * 25);
    this.scene.lightning(0.5 + WIN_TIERS.indexOf(tier) * 0.1);
    await this.popups.bigWin(tier, amount, { fast: this.fast, sfx: this.sfx });
    this.characters?.onBigWinEnd?.();
  }

  async enterFeature(record, kind, firstSpin) {
    const trigger = record.pendingTrigger;
    const bought = !!record.featureInfo?.bought;
    const isSuper = !!record.featureInfo?.super;
    const spins = trigger?.spins ?? FREE_GAME.award;
    this.sfx?.play('fgIntro');
    this.characters?.onFeatureEnter?.(kind);
    this.scene.lightning(0.9);
    if (!isSuper) await this.popups.featureAlert(kind, spins, { fast: this.fast, bought });
    await this.popups.transition(kind === 'awaken' ? 'nfg' : 'fg', { fast: this.fast });
    this.scene.setTheme(kind === 'awaken' ? 'nfg' : 'fg');
    this.characters?.setMode?.(kind === 'awaken' ? 'nfg' : 'fg');
    this.hud.enterFeature(kind, isSuper);
    this.hud.setFreeSpins(isSuper ? 1 : spins, isSuper ? 1 : spins, 0, isSuper);
    this.sfx?.setMusic(kind === 'awaken' ? 'nfg' : 'fg');
    await this.pause(0.4);
  }

  async exitFeature(record, total, bet) {
    const isSuper = !!record.featureInfo?.super;
    await this.pause(0.4);
    this.characters?.onBigWinStart?.();
    await this.popups.featureTotal(total, record.featureInfo?.kind, { fast: this.fast, isSuper, bet });
    this.characters?.onBigWinEnd?.();
    this.characters?.onFeatureExit?.();
    await this.popups.transition('mg', { fast: this.fast });
    this.scene.setTheme('mg');
    this.characters?.setMode?.('mg');
    this.hud.exitFeature();
    this.sfx?.setMusic('mg');
  }
}
