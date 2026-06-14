import { writeFileSync } from "node:fs";

const topPath =
  "M2.62318e-08 5.33507C-7.59389e-05 5.01557 0.164845 4.71902 0.435432 4.55216L7.5969 0.135168C7.86745 -0.03171 8.20473 -0.0449234 8.48736 0.100289L14.3599 3.11756C14.994 3.44336 15.0291 4.34254 14.4223 4.71745L1.38978 12.7701C0.782479 13.1454 0.00159537 12.7055 0.00144344 11.988L2.62318e-08 5.33507Z";
const bottomPath =
  "M2.20538 14.8719C1.60145 14.4674 1.62153 13.5697 2.24294 13.1928L8.44849 9.42897C8.79123 9.2211 9.22489 9.24075 9.54758 9.47877L14.453 13.0972C14.9703 13.4787 14.9953 14.2458 14.5039 14.6605L9.4914 18.338C9.15418 18.6226 8.6703 18.6495 8.30384 18.4041L2.20538 14.8719Z";

const scale = 18;
const offsetX = (512 - 15 * scale) / 2;
const offsetY = (512 - 19 * scale) / 2;

const ease = {
  i: { x: [0.45], y: [1] },
  o: { x: [0.45], y: [0] },
};

function tokenize(path) {
  return path.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+)(?:e[-+]?\d+)?/gi) ?? [];
}

function point(x, y) {
  return [Number((offsetX + x * scale).toFixed(3)), Number((offsetY + y * scale).toFixed(3))];
}

function tangent(a, b) {
  return [Number((a[0] - b[0]).toFixed(3)), Number((a[1] - b[1]).toFixed(3))];
}

function svgPathToLottie(path) {
  const tokens = tokenize(path);
  let index = 0;
  let command = "";
  let current = [0, 0];
  const v = [];
  const i = [];
  const o = [];
  let closed = false;

  const number = () => Number(tokens[index++]);
  const hasNumber = () => index < tokens.length && !/^[a-zA-Z]$/.test(tokens[index]);
  const addPoint = (next, inTangent = [0, 0], outTangentForPrevious = [0, 0]) => {
    if (v.length > 0) {
      o[o.length - 1] = outTangentForPrevious;
    }
    v.push(next);
    i.push(inTangent);
    o.push([0, 0]);
    current = next;
  };

  while (index < tokens.length) {
    if (/^[a-zA-Z]$/.test(tokens[index])) {
      command = tokens[index++];
    }

    if (command === "M") {
      addPoint(point(number(), number()));
      while (hasNumber()) addPoint(point(number(), number()));
    } else if (command === "L") {
      while (hasNumber()) addPoint(point(number(), number()));
    } else if (command === "C") {
      while (hasNumber()) {
        const c1 = point(number(), number());
        const c2 = point(number(), number());
        const end = point(number(), number());
        addPoint(end, tangent(c2, end), tangent(c1, current));
      }
    } else if (command === "Z" || command === "z") {
      closed = true;
      command = "";
    } else {
      throw new Error(`Unsupported SVG path command: ${command}`);
    }
  }

  return { c: closed, v, i, o };
}

function staticTransform() {
  return {
    o: { a: 0, k: 100 },
    r: { a: 0, k: 0 },
    p: { a: 0, k: [0, 0, 0] },
    a: { a: 0, k: [0, 0, 0] },
    s: { a: 0, k: [100, 100, 100] },
  };
}

function animatedOpacity(keyframes) {
  return {
    a: 1,
    k: keyframes.map(([t, value], index) => (index === keyframes.length - 1 ? { t, s: [value] } : { t, s: [value], ...ease })),
  };
}

function animatedScale(keyframes) {
  return {
    a: 1,
    k: keyframes.map(([t, value], index) =>
      index === keyframes.length - 1 ? { t, s: [value, value, 100] } : { t, s: [value, value, 100], ...ease },
    ),
  };
}

function animatedPosition(keyframes) {
  return {
    a: 1,
    k: keyframes.map(([t, x, y], index) =>
      index === keyframes.length - 1 ? { t, s: [x, y, 0] } : { t, s: [x, y, 0], ...ease },
    ),
  };
}

function centeredTransform({ opacity, scale, position } = {}) {
  return {
    ...staticTransform(),
    o: opacity ?? { a: 0, k: 100 },
    p: position ?? { a: 0, k: [256, 256, 0] },
    a: { a: 0, k: [256, 256, 0] },
    s: scale ?? { a: 0, k: [100, 100, 100] },
  };
}

function groupTransform({ opacity = 100, scaleValue = [100, 100], anchorCenter = false } = {}) {
  return {
    ty: "tr",
    p: { a: 0, k: anchorCenter ? [256, 256] : [0, 0] },
    a: { a: 0, k: anchorCenter ? [256, 256] : [0, 0] },
    s: Array.isArray(scaleValue)
      ? { a: 0, k: scaleValue }
      : {
          a: 1,
          k: [
            { t: 0, s: [100, 100], ...ease },
            { t: 72, s: [100, 100], ...ease },
            { t: 92, s: [scaleValue, scaleValue], ...ease },
            { t: 120, s: [100, 100] },
          ],
        },
    r: { a: 0, k: 0 },
    o:
      { a: 0, k: opacity },
  };
}

function logoShape(fillOrStroke, pathData) {
  const items = [
    { ty: "sh", ks: { a: 0, k: pathData } },
    fillOrStroke,
    groupTransform(),
  ];
  return { ty: "gr", it: items };
}

function logoNeutralFill() {
  return {
    ty: "fl",
    c: { a: 0, k: [0, 0, 0, 1] },
    o: { a: 0, k: 100 },
  };
}

function logoLayer(name, shapes, extraKs = {}, centered = false) {
  return {
    ty: 4,
    nm: name,
    ip: 0,
    op: 120,
    st: 0,
    ks: centered ? { ...centeredTransform(), ...extraKs } : { ...staticTransform(), ...extraKs },
    shapes,
  };
}

function backgroundLayer() {
  return logoLayer("background", [
    {
      ty: "gr",
      it: [
        { ty: "rc", p: { a: 0, k: [256, 256] }, s: { a: 0, k: [512, 512] }, r: { a: 0, k: 0 } },
        { ty: "fl", c: { a: 0, k: [1, 1, 1, 1] }, o: { a: 0, k: 100 } },
        groupTransform(),
      ],
    },
  ]);
}

const top = svgPathToLottie(topPath);
const bottom = svgPathToLottie(bottomPath);

const lottie = {
  v: "5.7.0",
  fr: 60,
  ip: 0,
  op: 120,
  w: 512,
  h: 512,
  assets: [],
  slots: {},
  layers: [
    logoLayer(
      "top fill piece",
      [logoShape(logoNeutralFill(), top)],
      {
        o: animatedOpacity([
          [0, 0],
          [8, 0],
          [34, 16],
          [78, 14],
          [120, 0],
        ]),
        p: animatedPosition([
          [0, 238, 248],
          [42, 256, 256],
          [92, 256, 256],
          [120, 238, 248],
        ]),
        s: animatedScale([
          [0, 94],
          [42, 101],
          [72, 100],
          [96, 100.8],
          [120, 94],
        ]),
      },
      true,
    ),
    logoLayer(
      "bottom fill piece",
      [logoShape(logoNeutralFill(), bottom)],
      {
        o: animatedOpacity([
          [0, 0],
          [16, 0],
          [46, 15],
          [82, 13],
          [120, 0],
        ]),
        p: animatedPosition([
          [0, 274, 266],
          [50, 256, 256],
          [92, 256, 256],
          [120, 274, 266],
        ]),
        s: animatedScale([
          [0, 92],
          [50, 101],
          [74, 100],
          [96, 100.8],
          [120, 92],
        ]),
      },
      true,
    ),
    backgroundLayer(),
  ],
};

const controls = {
  controls: [],
};

writeFileSync(new URL("../public/lottie.json", import.meta.url), `${JSON.stringify(lottie, null, 2)}\n`);
writeFileSync(new URL("../public/controls.json", import.meta.url), `${JSON.stringify(controls, null, 2)}\n`);
