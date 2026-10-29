import Phaser from 'phaser';
import { NOIR_CONTRAST } from '../config';

/** Most coloured zones, rings and lamps one pass can hold. Level 3 has six posters plus the start zone. */
export const MAX_ZONES = 16;
export const MAX_RINGS = 8;
export const MAX_LAMPS = 8;

/** The cold grade for gray ground: red down, blue up, blue lifted in the shadows (see `noirMatrix`). */
const COLD = { r: 0.86, g: 0.97, b: 1.14, lift: 9 };

const FRAGMENT = [
  '#pragma phaserTemplate(shaderName)',
  '#ifdef GL_FRAGMENT_PRECISION_HIGH',
  'precision highp float;',
  '#else',
  'precision mediump float;',
  '#endif',
  'uniform sampler2D uMainSampler;',
  'uniform sampler2D uBeam;',
  'uniform vec2 uSize;',
  'uniform float uFlipY;',
  'uniform float uGray;',
  'uniform float uCover;',
  'uniform int uZoneN;',
  'uniform int uRingN;',
  'uniform int uLampN;',
  `uniform vec4 uRect[${MAX_ZONES}];`,
  `uniform vec4 uCirc[${MAX_ZONES}];`,
  'uniform vec4 uAura;',
  `uniform vec4 uRing[${MAX_RINGS}];`,
  'uniform float uDark;',
  'uniform vec4 uPip;',
  `uniform vec4 uLamp[${MAX_LAMPS}];`,
  'varying vec2 outTexCoord;',
  // Screen position in design pixels, y down.
  'float soft(vec2 p, vec4 c)',
  '{',
  '  if (c.w <= 0.0 || c.z <= 0.0) return 0.0;',
  '  float d = distance(p, c.xy) / c.z;',
  '  float a = 0.0;',
  '  if (d < 0.75) a = 1.0 - (1.0 - 0.35 * c.w) * (1.0 - 0.35 * c.w) * (1.0 - 0.5 * c.w);',
  '  else if (d < 0.88) a = 1.0 - (1.0 - 0.35 * c.w) * (1.0 - 0.35 * c.w);',
  '  else if (d < 1.0) a = 0.35 * c.w;',
  '  return a;',
  '}',
  'float hole(vec2 p, vec4 c)',
  '{',
  '  if (c.z <= 0.0) return 1.0;',
  '  float d = distance(p, c.xy) / c.z;',
  '  if (d < 0.68) return 0.25025;',
  '  if (d < 0.85) return 0.3575;',
  '  if (d < 1.0) return 0.55;',
  '  return 1.0;',
  '}',
  'void main ()',
  '{',
  '  vec4 c = texture2D(uMainSampler, outTexCoord);',
  '  vec2 p = vec2(outTexCoord.x, mix(1.0 - outTexCoord.y, outTexCoord.y, uFlipY)) * uSize;',
  '  vec3 rgb = c.a > 0.0 ? c.rgb / c.a : c.rgb;',
  '  if (uGray > 0.5)',
  '  {',
  '    float m = 0.0;',
  '    if (uCover > 0.5)',
  '    {',
  '    for (int i = 0; i < ' + MAX_ZONES + '; i++)',
  '    {',
  '      if (i >= uZoneN) break;',
  '      vec4 r = uRect[i];',
  '      if (p.x < r.x || p.y < r.y || p.x > r.x + r.z || p.y > r.y + r.w) continue;',
  '      vec4 s = uCirc[i];',
  '      if (s.z < 0.0 || distance(p, s.xy) < s.z) m = 1.0;',
  '    }',
  '    float a = soft(p, uAura);',
  '    m = 1.0 - (1.0 - m) * (1.0 - a);',
  `    for (int i = 0; i < ${MAX_RINGS}; i++)`,
  '    {',
  '      if (i >= uRingN) break;',
  '      float q = soft(p, uRing[i]);',
  '      m = 1.0 - (1.0 - m) * (1.0 - q);',
  '    }',
  '    }',
  '    if (m < 1.0)',
  '    {',
  `      float g = (rgb.r + rgb.g + rgb.b) * ${((1 + NOIR_CONTRAST) / 3).toFixed(5)} - ${(0.5 * NOIR_CONTRAST).toFixed(5)};`,
  `      vec3 cold = vec3(g * ${COLD.r}, g * ${COLD.g}, g * ${COLD.b} + ${(COLD.lift / 255).toFixed(5)});`,
  '      rgb = mix(clamp(cold, 0.0, 1.0), rgb, m);',
  '    }',
  '  }',
  '  if (uDark > 0.0)',
  '  {',
  '    float rem = hole(p, uPip);',
  `    for (int i = 0; i < ${MAX_LAMPS}; i++)`,
  '    {',
  '      if (i >= uLampN) break;',
  '      rem *= hole(p, uLamp[i]);',
  '    }',
  '    float b = texture2D(uBeam, vec2(outTexCoord.x, mix(outTexCoord.y, 1.0 - outTexCoord.y, uFlipY))).a;',
  '    rem *= 1.0 - b;',
  '    rgb = mix(rgb, vec3(0.0196, 0.0275, 0.0588), uDark * rem);',
  '  }',
  '  gl_FragColor = vec4(rgb * c.a, c.a);',
  '}',
].join('\n');

const NODE = 'FilterNoirGrade';

/** What one frame of the grade needs. Positions are screen-space design pixels. */
export interface GradeState {
  gray: boolean;
  /** False when no colour shows anywhere on screen, so the pass skips the zone, glow and ring tests. */
  cover: boolean;
  zoneN: number;
  rect: Float32Array;
  circ: Float32Array;
  aura: [number, number, number, number];
  ringN: number;
  ring: Float32Array;
  dark: number;
  pip: [number, number, number, number];
  lampN: number;
  lamp: Float32Array;
  beam: Phaser.Textures.DynamicTexture;
}

type AnyFn = new (...a: unknown[]) => unknown;

/** Registers the node once per renderer. */
function register(renderer: Phaser.Renderer.WebGL.WebGLRenderer): void {
  const nodes = renderer.renderNodes as unknown as { hasNode?: (n: string) => boolean; _nodeConstructors?: Record<string, unknown>; addNodeConstructor: (n: string, c: AnyFn) => void };
  if (nodes._nodeConstructors && nodes._nodeConstructors[NODE]) return;
  const Base = (Phaser.Renderer.WebGL as unknown as { RenderNodes: { BaseFilterShader: AnyFn } }).RenderNodes.BaseFilterShader;
  const Node = (Phaser as unknown as { Class: (d: object) => AnyFn }).Class({
    Extends: Base,
    initialize: function (this: { constructor: unknown }, manager: unknown) {
      (Base as unknown as (this: unknown, n: string, m: unknown, k: null, f: string) => void).call(this, NODE, manager, null, FRAGMENT);
    },
    setupTextures: function (controller: { state: GradeState }, textures: unknown[]) {
      textures[1] = controller.state.beam.get().glTexture;
    },
    setupUniforms: function (this: { programManager: { setUniform: (n: string, v: unknown) => void } }, controller: { state: GradeState; flipY: number }) {
      const s = controller.state;
      const u = this.programManager.setUniform.bind(this.programManager);
      u('uBeam', 1);
      u('uSize', [540, 960]);
      u('uFlipY', controller.flipY);
      u('uGray', s.gray ? 1 : 0);
      u('uCover', s.cover ? 1 : 0);
      u('uZoneN', s.zoneN);
      u('uRect[0]', s.rect);
      u('uCirc[0]', s.circ);
      u('uAura', s.aura);
      u('uRingN', s.ringN);
      u('uRing[0]', s.ring);
      u('uDark', s.dark);
      u('uPip', s.pip);
      u('uLampN', s.lampN);
      u('uLamp[0]', s.lamp);
    },
  });
  nodes.addNodeConstructor(NODE, Node);
}

/** The single filter pass: noir gray, colour zones, aura and rings, then night darkness. */
export function addGradeFilter(layer: Phaser.GameObjects.Layer, state: GradeState, flipY: number): Phaser.Filters.Controller {
  register(layer.scene.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer);
  const list = layer.filters!.internal;
  const Ctl = (Phaser as unknown as { Class: (d: object) => new (cam: unknown) => Phaser.Filters.Controller }).Class({
    Extends: Phaser.Filters.Controller,
    initialize: function (this: unknown, camera: unknown) {
      (Phaser.Filters.Controller as unknown as (this: unknown, c: unknown, n: string) => void).call(this, camera, NODE);
    },
  });
  const ctl = new Ctl(list.camera) as Phaser.Filters.Controller & { state: GradeState; flipY: number };
  ctl.state = state;
  ctl.flipY = flipY;
  list.add(ctl);
  return ctl;
}
