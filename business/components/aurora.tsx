'use client';

import { Color, Mesh, Program, Renderer, Triangle } from 'ogl';
import { useEffect, useRef } from 'react';
import { cx } from './cx';

/**
 * The hero's shader field: a band of light that drifts across the top of
 * the page, built the way React Bits builds its Aurora — one full-screen
 * triangle, simplex noise driving the band's height, and a colour ramp
 * across the horizontal axis.
 *
 * Three things here are deliberate and are the reason this is ~150 lines
 * rather than the ~60 a demo would need.
 *
 * It never runs off-screen. An IntersectionObserver stops the frame loop
 * the moment the hero scrolls away, because the visitor spends most of
 * their time below it and a marketing page has no business holding a GPU
 * loop open while nobody is looking at it.
 *
 * It never runs at all for a visitor who asked for stillness, and never
 * runs if WebGL is missing. Both cases fall through to `.aurora-still`,
 * the CSS gradient underneath — which is also what is painted during the
 * first frames before the canvas has anything in it, so the hero never
 * flashes an empty rectangle.
 *
 * The ramp stays inside the accent's own hue. An aurora across a violet
 * -> pink -> cyan sweep is what every generated landing page looks like;
 * this one is teal because the rest of the product is.
 */

const COLOR_STOPS = ['#115E59', '#2DD4BF', '#0F766E'] as const;

const VERTEX = `#version 300 es
in vec2 uv;
in vec2 position;

out vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

/*
 * Ashima's 2D simplex noise, unchanged — it is the standard
 * implementation and rewriting it would only introduce bugs. The aurora
 * uses it once per fragment to decide how high the band reaches at this
 * horizontal position and this moment.
 */
const FRAGMENT = `#version 300 es
precision highp float;

uniform float uTime;
uniform float uAmplitude;
uniform vec3 uColorStops[3];
uniform vec2 uResolution;
uniform float uBlend;

out vec4 fragColor;

vec3 permute(vec3 x) {
  return mod(((x * 34.0) + 1.0) * x, 289.0);
}

float snoise(vec2 v) {
  const vec4 C = vec4(
    0.211324865405187, 0.366025403784439,
    -0.577350269189626, 0.024390243902439
  );
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);

  vec3 p = permute(
    permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0)
  );

  vec3 m = max(
    0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)),
    0.0
  );
  m = m * m;
  m = m * m;

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);

  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

struct ColorStop {
  vec3 color;
  float position;
};

vec3 rampAt(ColorStop stops[3], float factor) {
  int index = 0;
  for (int i = 0; i < 2; i++) {
    if (stops[i].position <= factor) {
      index = i;
    }
  }
  ColorStop current = stops[index];
  ColorStop next = stops[index + 1];
  float span = next.position - current.position;
  return mix(current.color, next.color, (factor - current.position) / span);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;

  ColorStop stops[3];
  stops[0] = ColorStop(uColorStops[0], 0.0);
  stops[1] = ColorStop(uColorStops[1], 0.5);
  stops[2] = ColorStop(uColorStops[2], 1.0);

  vec3 rampColor = rampAt(stops, uv.x);

  float height = snoise(vec2(uv.x * 2.0 + uTime * 0.1, uTime * 0.25))
    * 0.5 * uAmplitude;
  height = exp(height);
  height = uv.y * 2.0 - height + 0.2;

  float intensity = 0.6 * height;
  float midPoint = 0.20;
  float alpha = smoothstep(
    midPoint - uBlend * 0.5,
    midPoint + uBlend * 0.5,
    intensity
  );

  fragColor = vec4(intensity * rampColor * alpha, alpha);
}
`;

export function Aurora({
  className,
  amplitude = 1.0,
  blend = 0.5,
  speed = 0.4,
}: {
  className?: string;
  /** How far the band reaches up the frame. */
  amplitude?: number;
  /** Softness of the band's lower edge. 0 is a hard line. */
  blend?: number;
  speed?: number;
}) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = host.current;
    if (!node) return;

    // Read once, at mount. A visitor who changes this preference
    // mid-visit is not a case worth a listener; a visitor who set it
    // before arriving is the whole point.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let renderer: Renderer;
    try {
      renderer = new Renderer({ alpha: true, premultipliedAlpha: true, antialias: true });
    } catch {
      // No WebGL. The still gradient underneath is already correct.
      return;
    }

    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.canvas.style.backgroundColor = 'transparent';

    const program = new Program(gl, {
      vertex: VERTEX,
      fragment: FRAGMENT,
      uniforms: {
        uTime: { value: 0 },
        uAmplitude: { value: amplitude },
        uBlend: { value: blend },
        uResolution: { value: [node.offsetWidth, node.offsetHeight] },
        uColorStops: {
          value: COLOR_STOPS.map((hex) => {
            const { r, g, b } = new Color(hex);
            return [r, g, b];
          }),
        },
      },
    });

    const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });
    node.appendChild(gl.canvas);

    const resize = () => {
      renderer.setSize(node.offsetWidth, node.offsetHeight);
      program.uniforms.uResolution.value = [node.offsetWidth, node.offsetHeight];
    };
    resize();

    const observer = new ResizeObserver(resize);
    observer.observe(node);

    let frame = 0;
    let running = false;

    const draw = (time: number) => {
      frame = requestAnimationFrame(draw);
      program.uniforms.uTime.value = (time * 0.001) * speed;
      renderer.render({ scene: mesh });
    };

    // The frame loop only exists while the hero is on screen.
    const visibility = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !running) {
          running = true;
          frame = requestAnimationFrame(draw);
        } else if (!entry.isIntersecting && running) {
          running = false;
          cancelAnimationFrame(frame);
        }
      },
      { rootMargin: '120px' },
    );
    visibility.observe(node);

    return () => {
      cancelAnimationFrame(frame);
      visibility.disconnect();
      observer.disconnect();
      if (gl.canvas.parentNode === node) node.removeChild(gl.canvas);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [amplitude, blend, speed]);

  return (
    <div
      ref={host}
      aria-hidden="true"
      className={cx(
        'aurora-still pointer-events-none absolute inset-0 overflow-hidden [&>canvas]:h-full [&>canvas]:w-full',
        className,
      )}
    />
  );
}
