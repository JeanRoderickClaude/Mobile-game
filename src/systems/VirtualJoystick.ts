import Phaser from 'phaser';

/**
 * Floating on-screen joystick. Touching anywhere on the canvas places the
 * base under the finger; dragging moves the thumb. Fixed to the camera.
 * Mouse dragging works too, which helps when testing on desktop.
 */
export class VirtualJoystick {
  /** Direction with length 0..1. */
  readonly vector = new Phaser.Math.Vector2();

  private base: Phaser.GameObjects.Arc;
  private thumb: Phaser.GameObjects.Arc;
  private pointerId: number | null = null;
  private originX = 0;
  private originY = 0;
  private readonly radius = 60;

  constructor(private scene: Phaser.Scene) {
    this.base = scene.add.circle(0, 0, this.radius, 0xffffff, 0.15).setStrokeStyle(3, 0xffffff, 0.5);
    this.thumb = scene.add.circle(0, 0, 26, 0xffffff, 0.5);
    for (const o of [this.base, this.thumb]) o.setScrollFactor(0).setDepth(100).setVisible(false);

    scene.input.on('pointerdown', this.onDown, this);
    scene.input.on('pointermove', this.onMove, this);
    scene.input.on('pointerup', this.onUp, this);
    scene.input.on('pointerupoutside', this.onUp, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  private onDown(p: Phaser.Input.Pointer): void {
    if (this.pointerId !== null) return;
    this.pointerId = p.id;
    this.originX = p.x;
    this.originY = p.y;
    this.base.setPosition(p.x, p.y).setVisible(true);
    this.thumb.setPosition(p.x, p.y).setVisible(true);
    this.vector.set(0, 0);
  }

  private onMove(p: Phaser.Input.Pointer): void {
    if (p.id !== this.pointerId) return;
    const dx = p.x - this.originX;
    const dy = p.y - this.originY;
    const len = Math.hypot(dx, dy);
    const clamped = Math.min(len, this.radius);
    const nx = len > 0 ? dx / len : 0;
    const ny = len > 0 ? dy / len : 0;
    this.thumb.setPosition(this.originX + nx * clamped, this.originY + ny * clamped);
    // Small dead zone so a resting thumb does not drift.
    const strength = clamped < 8 ? 0 : clamped / this.radius;
    this.vector.set(nx * strength, ny * strength);
  }

  private onUp(p: Phaser.Input.Pointer): void {
    if (p.id !== this.pointerId) return;
    this.pointerId = null;
    this.vector.set(0, 0);
    this.base.setVisible(false);
    this.thumb.setVisible(false);
  }

  destroy(): void {
    this.scene.input.off('pointerdown', this.onDown, this);
    this.scene.input.off('pointermove', this.onMove, this);
    this.scene.input.off('pointerup', this.onUp, this);
    this.scene.input.off('pointerupoutside', this.onUp, this);
  }
}
