// ============================================================================
// ActiveCursor - 精致优雅的动态光标
// 在智能体执行任务时显示，让界面更生动
// ============================================================================

import chalk from 'chalk';

// ============================================================================
// Types
// ============================================================================

export interface CursorOptions {
  /** 光标颜色（默认紫色） */
  color?: string;
  /** 动画速度（毫秒） */
  speed?: number;
  /** 是否启用 */
  enabled?: boolean;
  /** 动画风格 */
  style?: 'modern' | 'classic' | 'minimal' | 'fancy';
}

// ============================================================================
// 精致的动画帧集合
// 每种风格都有独特的设计和视觉效果
// ============================================================================

// 现代风格 - 流畅的点阵动画
const MODERN_FRAMES = [
  '⣷', '⣯', '⣟', '⡿', '⢿', '⣻', '⣽', '⣾'
];

// 经典风格 - 优雅的圆圈旋转
const CLASSIC_FRAMES = [
  '◌', '◍', '◎', '●', '◉', '◐', '◑', '◒', '◓', '◔', '◕'
];

// 极简风格 - 简洁的点动画
const MINIMAL_FRAMES = [
  '•', '◦', '•', '◦'
];

// 华丽风格 - 复杂的多层动画
const FANCY_FRAMES = [
  '✧', '✦', '✧', '✦', '★', '☆', '★', '☆'
];

// 流星效果 - 动态尾迹
const METEOR_FRAMES = [
  '➤', '➦', '➧', '➨', '➩', '➪', '➫', '➬'
];

// ============================================================================
// 动画风格配置
// ============================================================================

const STYLE_CONFIG = {
  modern: {
    frames: MODERN_FRAMES,
    speed: 80,
    padding: '  '
  },
  classic: {
    frames: CLASSIC_FRAMES,
    speed: 100,
    padding: '  '
  },
  minimal: {
    frames: MINIMAL_FRAMES,
    speed: 120,
    padding: '   '
  },
  fancy: {
    frames: FANCY_FRAMES,
    speed: 90,
    padding: '  '
  }
};

// ============================================================================
// ActiveCursor class
// ============================================================================

/**
 * 精致优雅的动态光标
 *
 * 特性：
 * - 4种动画风格（现代、经典、极简、华丽）
 * - 流畅的渐变效果
 * - 可自定义颜色和速度
 * - 自动清理资源
 */
export class ActiveCursor {
  protected options: Required<CursorOptions>;
  private timer: NodeJS.Timeout | null = null;
  protected frameIndex = 0;
  private visible = false;
  private colorFn: (text: string) => string;
  protected styleConfig: typeof STYLE_CONFIG[keyof typeof STYLE_CONFIG];

  constructor(options: CursorOptions = {}) {
    this.options = {
      color: options.color ?? '#7C3AED', // 默认紫色
      speed: options.speed ?? 100,       // 默认 100ms
      enabled: options.enabled ?? true,
      style: options.style ?? 'modern',  // 默认现代风格
    };

    this.styleConfig = STYLE_CONFIG[this.options.style];
    this.colorFn = chalk.hex(this.options.color);
  }

  /**
   * 开始显示光标
   */
  start(): void {
    if (!this.options.enabled) return;
    if (this.visible) return;

    this.visible = true;
    this.frameIndex = 0;

    // 立即显示第一帧
    this.renderFrame();

    // 启动动画
    this.timer = setInterval(() => {
      this.frameIndex = (this.frameIndex + 1) % this.styleConfig.frames.length;
      this.renderFrame();
    }, this.options.speed);
  }

  /**
   * 停止显示光标
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    if (this.visible) {
      this.visible = false;
      // 清除光标显示
      process.stdout.write('\r' + ' '.repeat(8) + '\r');
    }
  }

  /**
   * 更新光标状态
   */
  update(options: Partial<CursorOptions>): void {
    let needsRestart = false;

    if (options.color && options.color !== this.options.color) {
      this.options.color = options.color;
      this.colorFn = chalk.hex(options.color);
    }

    if (options.speed !== undefined && options.speed !== this.options.speed) {
      this.options.speed = options.speed;
      needsRestart = true;
    }

    if (options.style && options.style !== this.options.style) {
      this.options.style = options.style;
      this.styleConfig = STYLE_CONFIG[options.style];
      needsRestart = true;
    }

    if (options.enabled !== undefined) {
      this.options.enabled = options.enabled;
      if (!options.enabled) {
        this.stop();
      }
    }

    // 重启动画以应用新设置
    if (needsRestart && this.visible) {
      this.stop();
      this.start();
    }
  }

  /**
   * 检查光标是否可见
   */
  isVisible(): boolean {
    return this.visible;
  }

  /**
   * 获取当前帧的文本（用于自定义渲染）
   */
  getCurrentFrame(): string {
    const frame = this.styleConfig.frames[this.frameIndex];
    return this.colorFn(frame);
  }

  /**
   * 渲染当前帧
   */
  protected renderFrame(): void {
    const frame = this.styleConfig.frames[this.frameIndex];
    const coloredFrame = this.colorFn(frame);
    process.stdout.write(`\r${this.styleConfig.padding}${coloredFrame}`);
  }

  /**
   * 清理资源
   */
  destroy(): void {
    this.stop();
  }
}

// ============================================================================
// Factory function
// ============================================================================

export function createActiveCursor(options?: CursorOptions): ActiveCursor {
  return new ActiveCursor(options);
}

// ============================================================================
// Preset cursors
// ============================================================================

/**
 * 紫色光标（默认）- 现代风格
 */
export function createPurpleCursor(): ActiveCursor {
  return new ActiveCursor({ color: '#7C3AED', style: 'modern' });
}

/**
 * 现代紫色光标 - 流畅的点阵动画
 */
export function createModernPurpleCursor(): ActiveCursor {
  return new ActiveCursor({ color: '#7C3AED', style: 'modern' });
}

/**
 * 经典紫色光标 - 优雅的圆圈旋转
 */
export function createClassicPurpleCursor(): ActiveCursor {
  return new ActiveCursor({ color: '#7C3AED', style: 'classic' });
}

/**
 * 极简紫色光标 - 简洁的点动画
 */
export function createMinimalPurpleCursor(): ActiveCursor {
  return new ActiveCursor({ color: '#7C3AED', style: 'minimal' });
}

/**
 * 华丽紫色光标 - 复杂的多层动画
 */
export function createFancyPurpleCursor(): ActiveCursor {
  return new ActiveCursor({ color: '#7C3AED', style: 'fancy' });
}

/**
 * 蓝色现代光标
 */
export function createBlueCursor(): ActiveCursor {
  return new ActiveCursor({ color: '#3B82F6', style: 'modern' });
}

/**
 * 绿色现代光标
 */
export function createGreenCursor(): ActiveCursor {
  return new ActiveCursor({ color: '#10B981', style: 'modern' });
}

/**
 * 彩虹光标（会自动变色和切换风格）
 */
export class RainbowCursor extends ActiveCursor {
  private colors = ['#7C3AED', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#EC4899'];
  private colorIndex = 0;
  private styleIndex = 0;
  private styles: CursorOptions['style'][] = ['modern', 'classic', 'fancy'];

  constructor(options?: CursorOptions) {
    super(options);
  }

  protected renderFrame(): void {
    const frame = this.styleConfig.frames[this.frameIndex];
    const color = this.colors[this.colorIndex];
    const colorFn = chalk.hex(color);
    const coloredFrame = colorFn(frame);
    
    process.stdout.write(`\r${this.styleConfig.padding}${coloredFrame}`);

    // 每 6 帧切换颜色
    if (this.frameIndex % 6 === 0) {
      this.colorIndex = (this.colorIndex + 1) % this.colors.length;
    }

    // 每 12 帧切换风格
    if (this.frameIndex % 12 === 0) {
      this.styleIndex = (this.styleIndex + 1) % this.styles.length;
      this.styleConfig = STYLE_CONFIG[this.styles[this.styleIndex]];
    }
  }
}

export function createRainbowCursor(): RainbowCursor {
  return new RainbowCursor();
}

/**
 * 流星光标 - 动态尾迹效果
 */
export class MeteorCursor extends ActiveCursor {
  constructor(options?: CursorOptions) {
    super({ ...options, style: 'modern' });
    // 使用流星帧
    this.styleConfig = {
      frames: METEOR_FRAMES,
      speed: 70,
      padding: '  '
    };
  }
}

export function createMeteorCursor(): MeteorCursor {
  return new MeteorCursor({ color: '#7C3AED' });
}
