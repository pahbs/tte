"""Conceptual diagram of the TTE classes (tte_classes_diagram.png / .svg, at the top of the README).
Every example pixel is checked against classify() in lib/tte_map.py."""
import re, sys, warnings; warnings.filterwarnings('ignore')
import numpy as np, matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon, Rectangle
from matplotlib.collections import EllipseCollection
# the real code: slope_deg_4n, abruptness, classify (pure numpy), cut out of lib/tte_map.py so no GDAL is needed
import os
HERE = os.path.dirname(os.path.abspath(__file__))
src = open(os.path.join(HERE, '..', '..', 'lib', 'tte_map.py')).read()
ns = dict(np=np, GRID_RES=30.0, SPARSE_MAX=5, OPEN_MAX=30, RELERR_MAX=None, WATER_OCC_MIN=1)
i = src.index('def slope_deg_4n'); j = src.index('# ---------------------------------------------------------------------------\n# Tile driver')
exec(src[i:j], ns)
ns['RELERR_MAX'] = 0
NAMES = {1: 'Sparse & Uniform', 2: 'Sparse & Diffuse-gradual', 3: 'Sparse & Diffuse-rapid', 4: 'Sparse & Abrupt', 5: 'Open & Uniform', 6: 'Open & Diffuse-gradual',
         7: 'Open & Diffuse-rapid', 8: 'Open & Abrupt', 9: 'Intermediate & Closed', 10: 'Non-forest edge (dry)', 11: 'Non-forest edge (wet)'}
COL = dict(zip(range(1, 12), ['#5255a3', '#1796a3', '#fdbf6f', '#ff7f00', '#ffffbf', '#d9ef8b', '#91cf60', '#1a9850', '#c4c4c4', '#ff0000', '#0000ff']))
EX = {1: (3.5, 4, 4.5), 2: (3, 4, 5.5), 3: (1, 4, 8), 4: (0, 4, 15), 5: (16, 18, 20), 6: (12, 18, 24), 7: (4, 18, 36), 8: (0, 18, 85), 9: (45, 55, 65), 10: (0, 0, 40), 11: (0, 0, 40)}
res = {}
for k, (L, t, R) in EX.items():
    z = np.tile(np.array([[L, L, t, R, R]], float), (5, 1)); occ = np.zeros(z.shape)
    if k == 11: occ[:, 2] = 100
    o = ns['classify'](z.copy(), np.ones(z.shape, bool), occ)
    tcc_d = z.copy(); rate, ab = ns['abruptness'](tcc_d.astype(np.float32))
    got = int(o['tte_classification'][2, 2]); res[k] = (float(rate[2, 2]), float(o['tte_abruptness'][2, 2]), got)
    assert got == k, (k, got, res[k])
print('all 11 examples get their class from classify():', {k: (round(v[0], 1), round(v[1], 2)) for k, v in res.items()})
RM = np.degrees(np.arctan(np.hypot(100, 100) / 60)) / .9
INK, INK2, MUTE = '#1b1b1b', '#4a4a4a', '#8a8a8a'
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 9, 'text.color': INK, 'axes.labelcolor': INK, 'svg.fonttype': 'path', 'hatch.linewidth': .5})
HI = 7.0                                             # figure height (inches); Y(inches from the top) gives figure units
Y = lambda inch: 1 - inch / HI
fig = plt.figure(figsize=(15, HI), facecolor='white'); q = np.sqrt
fig.text(.035, Y(.40), 'A boundary without a fixed edge: mapping the taiga–tundra ecotone by its forest structure pattern', fontsize=17.6, weight='bold')
for yy, t in ((.66, 'The taiga–tundra ecotone is a geographic boundary of indeterminate extent, but that does not stop us from trying to determine its extent! Here, this conceptual model explains how we attempt to'),
              (.86, 'define this circumpolar biogeographic domain. We describe how it varies with satellite-based estimates of tree cover, an attribute of forest structure, and the spatial pattern of that cover.')):
    fig.text(.035, Y(yy), t, fontsize=9.8, color=INK2)
AT, AB = 1.70, 5.60                                  # top and bottom of the axes
U = 2 / (AB - AT)                                    # data units per inch on the y axis
ax = fig.add_axes([.085, Y(AB), .375, (AB - AT) / HI])
EDGE = [-1, -.5, 0, .5, 1]
for b in range(4):
    ax.add_patch(Rectangle((0, EDGE[b]), q(5), .5, fc=COL[1 + b], ec='white', lw=2.5)); ax.add_patch(Rectangle((q(5), EDGE[b]), q(30) - q(5), .5, fc=COL[5 + b], ec='white', lw=2.5))
ax.add_patch(Rectangle((q(30), -1), q(100) - q(30), 2, fc=COL[9], ec='white', lw=2.5))
tt = np.linspace(0, 100, 400); amax = (RM - tt) / (RM + tt)          # highest abruptness possible at each cover
ax.fill_between(q(tt), amax, 1, fc='white', alpha=.28, lw=0, zorder=3)
ax.plot(q(tt), amax, color='#333333', lw=1.1, ls=(0, (4, 3)), zorder=4)
x0_, x1_ = 55., 72.; sl = np.diff([(RM - v) / (RM + v) for v in (x0_, x1_)])[0] / U / ((q(x1_) - q(x0_)) / q(100) * .375 * 15)
ax.text(q(63), (RM - 63) / (RM + 63) + .03, 'highest abruptness possible', rotation=np.degrees(np.arctan(sl)), rotation_mode='anchor', ha='center', va='bottom', fontsize=8.6, color=INK2, zorder=5)
N2 = ['Uniform', 'Diffuse-gradual', 'Diffuse-rapid', 'Abrupt']
for b in range(4):
    yc = EDGE[b] + .25
    for k, xc in ((1 + b, q(5) / 2), (5 + b, (q(5) + q(30)) / 2)):
        c = 'white' if k in (1, 2, 8) else INK
        if k == 8: xc, yc_ = q(9.0), .575
        else: yc_ = yc
        ax.text(xc, yc_ + .06, str(k), ha='center', va='center', fontsize=17, weight='bold', color=c, zorder=5)
        ax.text(xc, yc_ - (.035 if k == 8 else .085), N2[b], ha='center', va='center', fontsize=9, color=c, zorder=5)
ax.text((q(30) + q(100)) / 2, -.43, '9', ha='center', va='center', fontsize=17, weight='bold', zorder=5); ax.text((q(30) + q(100)) / 2, -.575, 'any abruptness', ha='center', va='center', fontsize=9, zorder=5)
ax.plot(0, 1, 'o', ms=9, mfc='white', mec=INK, mew=1.4, clip_on=False, zorder=8)
ax.plot([0, .12], [1.0, 1 + .13 * U], color=INK, lw=.9, clip_on=False, zorder=7)
for k, xx in ((10, .27), (11, .67)):
    ax.plot(xx, 1 + .18 * U, 's', ms=17, mfc=COL[k], mec='white', mew=1, clip_on=False, zorder=8); ax.text(xx, 1 + .18 * U, str(k), color='white', ha='center', va='center', fontsize=8.5, weight='bold', zorder=9)
ax.text(.95, 1 + .18 * U, 'Non-forest edge, dry / wet: no cover, so abruptness is +1', fontsize=8.8, color=INK2, va='center')
for x0, x1, t in ((0, 5, 'Sparse'), (5, 30, 'Open'), (30, 100, 'Intermediate & closed')):
    ax.text((q(x0) + q(x1)) / 2, 1 + .38 * U, t, ha='center', fontsize=11.5, weight='bold')
ax.set_xlim(0, q(100)); ax.set_ylim(-1, 1); xt = [0, 5, 15, 30, 50, 75, 100]
ax.set_xticks(q(xt)); ax.set_xticklabels([str(v) for v in xt]); ax.set_yticks(EDGE); ax.set_yticklabels(['−1', '−0.5', '0', '+0.5', '+1'], fontsize=10)
ax.text(q(100) / 2, -1 - .40 * U, 'What is the tree cover?', ha='center', fontsize=13, weight='bold'); ax.text(q(100) / 2, -1 - .60 * U, 'Tree canopy cover (%, square root scaled)', ha='center', fontsize=10.5, color=INK2)
ax.text(-1.60, 0, 'How does tree cover change\nacross a spatial gradient?', rotation=90, ha='center', va='center', fontsize=13, weight='bold', linespacing=1.15); ax.text(-.98, 0, 'Abruptness:  uniform (−1)  to  abrupt (+1)', rotation=90, ha='center', va='center', fontsize=10.5, color=INK2)
for s_ in ax.spines.values(): s_.set_visible(False)
ax.tick_params(length=0, colors=INK2)
# examples
rng = np.random.default_rng(4); ORD = [rng.permutation(100) for _ in range(40)]
def strip(x0, y0, k, w=.0325):
    L, t, R = EX[k]; h = w * 15 / HI
    for m, v in enumerate((L, t, R)):
        a2 = fig.add_axes([x0 + m * (w + .0045), y0, w, h]); bg = [.955, .945, .915]
        if k == 11 and m == 1: bg = [.70, .82, .95]
        n = int(round(v)); idx = ORD[(k * 3 + m) % 40][:n]
        a2.set_facecolor(bg); a2.set_xlim(0, 10); a2.set_ylim(0, 10); a2.set_xticks([]); a2.set_yticks([])
        a2.add_collection(EllipseCollection([.94] * n, [.94] * n, [0] * n, units='x', offsets=np.c_[idx % 10 + .5, idx // 10 + .5].reshape(-1, 2), transOffset=a2.transData, fc=[.11, .35, .16], ec='none'))
        for s in a2.spines.values(): s.set_color(COL[k] if m == 1 and k not in (5, 6) else ('#b9b93a' if m == 1 else '#bbbbbb')); s.set_linewidth(.6)
    ec = COL[k] if k not in (5, 6) else '#b9b93a'
    fig.add_artist(Rectangle((x0 + w + .0045 - .0025, y0 - .0025 * 15 / HI), w + .005, h + .005 * 15 / HI, transform=fig.transFigure, fc='none', ec=ec, lw=3.2, zorder=9))
    rate, ab, _ = res[k]
    fig.text(x0 + 1.5 * w + .0045, y0 - .235 / HI, f'cover {t:g} %,  rate of change {rate:.0f}', ha='center', fontsize=8, color=INK2)
    fig.text(x0 + 1.5 * w + .0045, y0 - .395 / HI, f'abruptness {ab:+.1f}'.replace('-', '−'), ha='center', fontsize=8, color=INK2)
X0 = [.497, .622, .747, .872]; H = N2; H2 = ['−1 to −0.5', '−0.5 to 0', '0 to +0.5', '+0.5 to +1']; M = .0533
def chip(x, y, k):
    fig.patches.append(Rectangle((x - .0095, y), .019, .2 / HI, transform=fig.transFigure, fc=COL[k], ec=MUTE, lw=.5))
    fig.text(x, y + .095 / HI, str(k), ha='center', va='center', fontsize=10, weight='bold', color='white' if k in (1, 2, 8, 10, 11) else INK)
for x, a1, b1 in zip(X0, H, H2):
    fig.text(x + M, Y(1.27), a1, ha='center', fontsize=11.5, weight='bold'); fig.text(x + M, Y(1.44), 'abruptness ' + b1, ha='center', fontsize=9, color=INK2)
for y, ks, name in ((2.53, (1, 2, 3, 4), 'Sparse: tree cover up to 5 %'), (3.95, (5, 6, 7, 8), 'Open: tree cover 5 to 30 %')):   # y: bottom of the squares
    fig.text(X0[0], Y(y - .83), name, fontsize=10, weight='bold', color=INK2)
    for x, k in zip(X0, ks): strip(x, Y(y), k); chip(x + M, Y(y - .565), k)
y = 5.55; fig.text(X0[0], Y(y - 1.01), 'Three classes that do not use the abruptness bands', fontsize=10, weight='bold', color=INK2)
for x, k, a1, b1 in zip(X0, (9, 10, 11), ('Intermediate & closed', 'Non-forest edge, dry', 'Non-forest edge, wet'), ('cover over 30 %', 'no cover, beside trees', 'the same, on water')):
    strip(x, Y(y), k); chip(x + M, Y(y - .565), k); fig.text(x + M, Y(y - .83), a1, ha='center', fontsize=9.3, weight='bold'); fig.text(x + M, Y(y + .55), b1, ha='center', fontsize=8.5, color=INK2)
for yy, tx in ((6.46, 'Each square is a 30 m pixel seen from above. Dark cells are tree crowns. The outlined pixel is the one classified. Abruptness is the normalized difference between the spatial rate of change in tree cover and the tree'),
               (6.64, 'cover itself: (rate − cover) / (rate + cover). At 0 abruptness, the rate of change equals the cover; at +0.5 it is 3 times the cover, and at −0.5 one third of it. The rate of change is the slope of the tree cover surface,'),
               (6.82, 'rescaled to 0–100. Dashed line: the highest abruptness possible. The rate of change cannot exceed 75, so the more cover a pixel has, the less abrupt it can be: “Open & Abrupt” (8) occurs only below about 25 % cover.')):
    fig.text(.035, Y(yy), tx, fontsize=8.6, color=INK2)
for ext in ('png', 'svg'):
    fig.savefig(os.path.join(HERE, 'tte_classes_diagram.' + ext), dpi=130)
print('saved')
