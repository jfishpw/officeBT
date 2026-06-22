// 对话场景：显示剧情对话和选项
import { Scene, UIManager, uiManager } from './ui-manager';
import { SceneManager } from './scene';
import { gameStateMachine, GameState } from '../core/state-machine';
import {
  DialogueNode,
  DialogueChoice,
  DialogueEffect,
  StorySequence,
  RandomEvent,
} from '../data/story';
import { CharacterState } from '../game/character-manager';
import { DeckState } from '../game/deck-manager';

interface DialoguePayload {
  story: StorySequence | RandomEvent;
  currentNodeIndex?: number;
  onComplete?: () => void;
  nextState?: GameState;
  nextPayload?: any;
  character?: CharacterState;
  deck?: DeckState;
}

export class DialogueScene implements Scene {
  private container: HTMLElement | null = null;
  private payload!: DialoguePayload;
  private currentNodeIndex: number = 0;
  private currentNode!: DialogueNode;
  private accumulatedEffects: DialogueEffect[] = [];

  mount(container: HTMLElement): void {
    this.container = container;
    this.payload = gameStateMachine.getPayload() as DialoguePayload;
    this.currentNodeIndex = this.payload.currentNodeIndex ?? 0;
    this.accumulatedEffects = [];

    // 设置背景
    SceneManager.setBackground('meeting_room');

    // 获取当前节点
    this.currentNode = this.getCurrentNode();

    // 渲染界面
    this.render();
  }

  unmount(): void {
    this.container = null;
  }

  update?(data?: any): void {
    if (data) {
      this.payload = data as DialoguePayload;
      this.currentNodeIndex = this.payload.currentNodeIndex ?? 0;
      this.currentNode = this.getCurrentNode();
    }
  }

  private getCurrentNode(): DialogueNode {
    const { story } = this.payload;
    return story.nodes[this.currentNodeIndex];
  }

  private getTotalNodes(): number {
    const { story } = this.payload;
    return story.nodes.length;
  }

  private render(): void {
    if (!this.container) return;

    // 清空容器
    this.container.innerHTML = '';

    // 创建主容器
    const dialogueContainer = UIManager.createElement('div', 'dialogue-scene');
    dialogueContainer.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
      box-sizing: border-box;
    `;

    // 对话框
    const dialogueBox = UIManager.createElement('div', 'dialogue-box');
    dialogueBox.style.cssText = `
      background: rgba(255, 255, 255, 0.95);
      border-radius: var(--radius-xl);
      padding: 30px;
      max-width: 600px;
      width: 100%;
      box-shadow: var(--shadow-hover);
    `;

    // 说话人名称
    const speakerName = UIManager.createElement('div', 'dialogue-speaker');
    speakerName.style.cssText = `
      font-size: 18px;
      font-weight: bold;
      color: var(--color-primary);
      margin-bottom: 12px;
    `;
    speakerName.textContent = this.currentNode.speaker;

    // 对话文本
    const dialogueText = UIManager.createElement('div', 'dialogue-text');
    dialogueText.style.cssText = `
      font-size: 16px;
      line-height: 1.8;
      color: var(--color-text);
      margin-bottom: 24px;
    `;
    dialogueText.textContent = `"${this.currentNode.text}"`;

    // 选项或继续按钮区域
    const actionsContainer = UIManager.createElement('div', 'dialogue-actions');
    actionsContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 10px;
    `;

    if (this.currentNode.choices && this.currentNode.choices.length > 0) {
      // 有选项，显示选项按钮
      for (const choice of this.currentNode.choices) {
        const choiceBtn = UIManager.createElement('button', 'ui-btn ui-btn-primary', choice.text);
        choiceBtn.style.cssText = 'text-align: left; justify-content: flex-start;';
        choiceBtn.addEventListener('click', () => this.selectChoice(choice));
        actionsContainer.appendChild(choiceBtn);
      }
    } else {
      // 无选项，显示继续按钮
      const continueBtn = UIManager.createElement('button', 'ui-btn ui-btn-primary', '继续');
      continueBtn.addEventListener('click', () => this.advanceToNextNode());
      actionsContainer.appendChild(continueBtn);
    }

    dialogueBox.appendChild(speakerName);
    dialogueBox.appendChild(dialogueText);
    dialogueBox.appendChild(actionsContainer);

    dialogueContainer.appendChild(dialogueBox);
    this.container.appendChild(dialogueContainer);
  }

  private selectChoice(choice: DialogueChoice): void {
    // 如果有结果文本，先显示结果
    if (choice.resultText) {
      this.showResultAndContinue(choice);
    } else if (choice.effects && choice.effects.length > 0) {
      // 直接应用效果并继续
      this.applyEffects(choice.effects);
      this.continueToNextNode(choice.nextNodeId);
    } else {
      // 直接跳转到下一个节点
      this.continueToNextNode(choice.nextNodeId);
    }
  }

  private showResultAndContinue(choice: DialogueChoice): void {
    if (!this.container) return;

    // 清空容器
    this.container.innerHTML = '';

    // 创建结果显示容器
    const resultContainer = UIManager.createElement('div', 'dialogue-result-container');
    resultContainer.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
      box-sizing: border-box;
    `;

    // 结果框
    const resultBox = UIManager.createElement('div', 'dialogue-result-box');
    resultBox.style.cssText = `
      background: rgba(255, 255, 255, 0.95);
      border-radius: var(--radius-xl);
      padding: 30px;
      max-width: 600px;
      width: 100%;
      box-shadow: var(--shadow-hover);
      text-align: center;
    `;

    const resultText = UIManager.createElement('div', 'dialogue-result-text');
    resultText.style.cssText = `
      font-size: 16px;
      line-height: 1.8;
      color: var(--color-text);
      margin-bottom: 24px;
    `;
    resultText.textContent = choice.resultText ?? '';

    const continueBtn = UIManager.createElement('button', 'ui-btn ui-btn-primary', '继续');
    continueBtn.addEventListener('click', () => {
      if (choice.effects) {
        this.applyEffects(choice.effects);
      }
      this.continueToNextNode(choice.nextNodeId);
    });

    resultBox.appendChild(resultText);
    resultBox.appendChild(continueBtn);
    resultContainer.appendChild(resultBox);
    this.container.appendChild(resultContainer);
  }

  private applyEffects(effects: DialogueEffect[]): void {
    const { character, deck } = this.payload;
    if (!character) return;

    for (const effect of effects) {
      switch (effect.type) {
        case 'heal': {
          const healAmount = effect.value as number;
          character.currentHp = Math.min(
            character.maxHp,
            character.currentHp + healAmount
          );
          break;
        }
        case 'damage': {
          const damageAmount = effect.value as number;
          character.currentHp = Math.max(0, character.currentHp - damageAmount);
          break;
        }
        case 'gold': {
          const goldAmount = effect.value as number;
          character.gold = Math.max(0, character.gold + goldAmount);
          break;
        }
        case 'buff':
        case 'debuff':
          // Buff/Debuff 需要层数信息，在 story.ts 中定义
          // 这里只记录，在 onComplete 时由游戏逻辑处理
          this.accumulatedEffects.push(effect);
          break;
        case 'card':
        case 'upgrade_card':
        case 'remove_card':
          // 卡牌操作需要在 onComplete 时由游戏逻辑处理
          this.accumulatedEffects.push(effect);
          break;
      }
    }
  }

  private continueToNextNode(nextNodeId?: string): void {
    if (nextNodeId) {
      // 根据 nextNodeId 找到节点索引
      const { story } = this.payload;
      const nodeIndex = story.nodes.findIndex((n) => n.id === nextNodeId);
      if (nodeIndex !== -1) {
        this.currentNodeIndex = nodeIndex;
        this.currentNode = story.nodes[this.currentNodeIndex];
      } else {
        // 没找到指定的节点，尝试使用 nextNodeId 字符串作为偏移量
        // 这在某些事件中可能表示继续到下一个
        const nextIndex = this.currentNodeIndex + 1;
        if (nextIndex < this.getTotalNodes()) {
          this.currentNodeIndex = nextIndex;
          this.currentNode = this.getCurrentNode();
        } else {
          this.finishDialogue();
          return;
        }
      }
    } else {
      // 没有指定下一个节点，默认到下一个
      this.advanceToNextNode();
      return;
    }

    this.render();
  }

  private advanceToNextNode(): void {
    const nextIndex = this.currentNodeIndex + 1;
    if (nextIndex < this.getTotalNodes()) {
      this.currentNodeIndex = nextIndex;
      this.currentNode = this.getCurrentNode();
      this.render();
    } else {
      // 对话结束
      this.finishDialogue();
    }
  }

  private finishDialogue(): void {
    const { onComplete, nextState, nextPayload } = this.payload;

    // 调用完成回调
    if (onComplete) {
      onComplete();
    }

    // 如果有下一个状态，切换到该状态
    if (nextState) {
      gameStateMachine.transitionTo(nextState, nextPayload);
    }
  }
}
