{const s=document.createElement("style");s.dataset.vaudeModuleCss="1";s.textContent="/* src/ui/apps/press/styles.module.css */\n.roomHost_ZxwmOQ {\n  container-type: inline-size;\n  min-height: 100%;\n}\n\n.room2_ZxwmOQ {\n  display: grid;\n  grid-template-columns: 15rem minmax(0, 1fr);\n  align-items:  start;\n  gap: 1rem;\n  min-height: 100%;\n  padding: 1rem;\n}\n\n@container (width <= 52rem) {\n  .room2_ZxwmOQ {\n    grid-template-columns: minmax(0, 1fr);\n  }\n\n  .rail_ZxwmOQ {\n    position: static;\n    max-height: 14rem;\n  }\n}\n\n.kick_ZxwmOQ {\n  font-family: var(--font-mono);\n  letter-spacing: .14em;\n  text-transform: uppercase;\n  color: var(--stage-soft);\n  font-size: .66rem;\n  font-weight: 600;\n}\n\n.rail_ZxwmOQ {\n  border: 2px solid var(--stage-black);\n  background: var(--stage-row);\n  box-shadow: 4px 4px 0 0 var(--stage-black);\n  position: sticky;\n  overflow-y: auto;\n  scrollbar-width: thin;\n  max-height: calc(100dvh - 6.5rem);\n  padding: .7rem;\n  top: .5rem;\n}\n\n.offerList_ZxwmOQ {\n  display: flex;\n  flex-direction: column;\n  gap: .4rem;\n  margin-top: .55rem;\n}\n\n.offer_ZxwmOQ {\n  display: flex;\n  text-align: left;\n  font-family: var(--font-body);\n  color: var(--stage-soft);\n  background: var(--stage-sunken);\n  border: 2px solid var(--stage-black);\n  box-shadow: 2px 2px 0 0 var(--stage-black);\n  cursor: pointer;\n  justify-content: space-between;\n  align-items: baseline;\n  gap: .5rem;\n  padding: .35rem .5rem;\n  font-size: .85rem;\n}\n\n.offer_ZxwmOQ:hover {\n  color: var(--stage-paper);\n  background: var(--stage-row);\n}\n\n.offer_ZxwmOQ:active {\n  box-shadow: none;\n  transform: translate(2px, 2px);\n}\n\n.offerName_ZxwmOQ {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.bundle_ZxwmOQ {\n  border: 2px solid var(--stage-black);\n  background: var(--stage-row);\n  box-shadow: 4px 4px 0 0 var(--stage-black);\n  margin-bottom: .9rem;\n}\n\n.bundleMarq_ZxwmOQ {\n  display: flex;\n  border-bottom: 2px solid var(--stage-seam);\n  font-family: var(--font-mono);\n  letter-spacing: .12em;\n  text-transform: uppercase;\n  color: var(--stage-paper);\n  align-items:  center;\n  gap: .6rem;\n  padding: .45rem .7rem;\n  font-size: .64rem;\n}\n\n.bundleMarq_ZxwmOQ i {\n  color: var(--stage-dim);\n  margin-right: auto;\n  font-style: normal;\n}\n\n.unstage_ZxwmOQ {\n  font-family: var(--font-mono);\n  letter-spacing: .08em;\n  text-transform: uppercase;\n  color: var(--stage-dim);\n  cursor: pointer;\n  background: none;\n  border: none;\n  padding: .1rem .2rem;\n  font-size: .625rem;\n}\n\n.unstage_ZxwmOQ:hover {\n  color: var(--stage-danger-text);\n}\n\n.kcard_ZxwmOQ {\n  display: grid;\n  grid-template-columns: 1.05rem minmax(0, 1fr) auto auto;\n  border: 2px solid var(--stage-black);\n  box-shadow: 3px 3px 0 0 var(--stage-black);\n  background: var(--stage-sunken);\n  color: var(--stage-soft);\n  align-items:  center;\n  gap: .45rem .6rem;\n  margin: .6rem .85rem .7rem .7rem;\n  padding: .5rem .65rem;\n  font-size: .9rem;\n}\n\n.kcardDropped_ZxwmOQ {\n  opacity: .5;\n}\n\n.kname_ZxwmOQ {\n  color: var(--stage-paper);\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.riderDrop_ZxwmOQ {\n  font-family: var(--font-mono);\n  letter-spacing: .08em;\n  text-transform: uppercase;\n  color: var(--stage-dim);\n  border: 1px dashed var(--stage-line);\n  cursor: pointer;\n  background: none;\n  padding: .2rem .4rem;\n  font-size: .625rem;\n}\n\n.riderDrop_ZxwmOQ:hover {\n  color: var(--stage-paper);\n}\n\n.fixLink_ZxwmOQ {\n  font: inherit;\n  color: inherit;\n  text-decoration: underline;\n  cursor: pointer;\n  background: none;\n  border: none;\n  padding: 0;\n}\n\n.sheetHead_ZxwmOQ {\n  display: flex;\n  border-bottom: 2px solid var(--stage-seam);\n  flex-wrap: wrap;\n  align-items:  center;\n  gap: .8rem;\n  margin-bottom: .8rem;\n  padding-bottom: .6rem;\n}\n\n.sheetHead_ZxwmOQ .kick_ZxwmOQ {\n  margin-right: auto;\n}\n\n.targets_ZxwmOQ {\n  display: flex;\n  flex-wrap: wrap;\n  gap: .35rem;\n}\n\n.tchip_ZxwmOQ {\n  font-family: var(--font-mono);\n  letter-spacing: .08em;\n  text-transform: uppercase;\n  border: 2px solid var(--stage-black);\n  cursor: pointer;\n  color: var(--stage-soft);\n  background: var(--stage-sunken);\n  padding: .26rem .5rem;\n  font-size: .625rem;\n}\n\n.tchipOn_ZxwmOQ {\n  background: var(--accent-deep);\n  color: var(--stage-white);\n  box-shadow: 2px 2px 0 0 var(--stage-black);\n  font-weight: 800;\n}\n\n.fileEdit_ZxwmOQ {\n  grid-column: 2 / -1;\n  display: flex;\n  flex-wrap: wrap;\n  align-items:  center;\n  gap: .4rem;\n}\n\n.fileIn_ZxwmOQ {\n  font-family: var(--font-mono);\n  color: var(--stage-paper);\n  background: var(--stage-row);\n  border: 2px solid var(--stage-black);\n  min-width: 11rem;\n  padding: .26rem .4rem;\n  font-size: .68rem;\n}\n\n.flavor_ZxwmOQ {\n  font-family: var(--font-mono);\n  letter-spacing: .08em;\n  text-transform: uppercase;\n  border: 2px solid var(--stage-black);\n  cursor: pointer;\n  color: var(--stage-soft);\n  background: var(--stage-sunken);\n  padding: .22rem .4rem;\n  font-size: .625rem;\n}\n\n.flavorOn_ZxwmOQ {\n  background: var(--accent-deep);\n  color: var(--stage-white);\n}\n\n.jkind_ZxwmOQ {\n  font-family: var(--font-mono);\n  color: var(--stage-soft);\n  text-transform: uppercase;\n  font-size: .64rem;\n  font-weight: 600;\n}\n\n.jfile_ZxwmOQ {\n  grid-column: 2 / -1;\n  font-family: var(--font-mono);\n  color: var(--stage-dim);\n  font-size: .625rem;\n}\n\n.dot_ZxwmOQ {\n  border: 1px solid var(--stage-black);\n  background: var(--stage-faint);\n  width: .55rem;\n  height: .55rem;\n}\n\n.dotOk_ZxwmOQ {\n  background: var(--stage-ok);\n}\n\n.dotWarn_ZxwmOQ {\n  background: var(--stage-warn);\n}\n\n.dotFail_ZxwmOQ {\n  background: var(--stage-danger-edge);\n}\n\n.jnote_ZxwmOQ {\n  grid-column: 2 / -1;\n  font-size: .76rem;\n  font-family: var(--font-mono);\n  color: var(--stage-warn);\n}\n\n.jnoteFail_ZxwmOQ {\n  color: var(--stage-danger-text);\n}\n\n.jinfo_ZxwmOQ {\n  grid-column: 2 / -1;\n  font-size: .74rem;\n  font-family: var(--font-mono);\n  color: var(--stage-dim);\n}\n\n.empty_ZxwmOQ {\n  color: var(--stage-mute);\n  padding: 1.2rem .4rem;\n  font-size: .92rem;\n}\n\n.foot_ZxwmOQ {\n  display: flex;\n  border-top: 1px dashed var(--stage-line);\n  flex-wrap: wrap;\n  align-items:  center;\n  gap: .7rem;\n  margin-top: .8rem;\n  padding-top: .8rem;\n}\n\n.sum_ZxwmOQ {\n  font-family: var(--font-mono);\n  color: var(--stage-mute);\n  margin-right: auto;\n  font-size: .68rem;\n}\n\n.stamp_ZxwmOQ {\n  font-family: var(--font-mono);\n  letter-spacing: .1em;\n  text-transform: uppercase;\n  color: var(--stage-paper);\n  background: var(--stage-panel);\n  border: 2px solid var(--stage-black);\n  box-shadow: 2px 2px 0 0 var(--stage-black);\n  cursor: pointer;\n  padding: .4rem .8rem;\n  font-size: .66rem;\n}\n\n.stamp_ZxwmOQ:active {\n  box-shadow: none;\n  transform: translate(2px, 2px);\n}\n\n.stamp_ZxwmOQ:disabled {\n  opacity: .45;\n  cursor: default;\n  box-shadow: none;\n}\n\n.stampRun_ZxwmOQ {\n  background: var(--accent-deep);\n  color: var(--stage-white);\n  box-shadow: 4px 4px 0 0 var(--stage-black);\n  padding: .5rem 1.1rem;\n  font-size: .74rem;\n  font-weight: 800;\n}\n";document.head.append(s);}
// src/ui/apps/press/index.tsx
import { useEffect as useEffect2, useMemo, useState } from "react";

// node_modules/fflate/esm/browser.js
var u8 = Uint8Array;
var u16 = Uint16Array;
var i32 = Int32Array;
var fleb = new u8([0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, 0, 0, 0]);
var fdeb = new u8([0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13, 0, 0]);
var clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
var freb = function(eb, start) {
  var b = new u16(31);
  for (var i = 0;i < 31; ++i) {
    b[i] = start += 1 << eb[i - 1];
  }
  var r = new i32(b[30]);
  for (var i = 1;i < 30; ++i) {
    for (var j = b[i];j < b[i + 1]; ++j) {
      r[j] = j - b[i] << 5 | i;
    }
  }
  return { b, r };
};
var _a = freb(fleb, 2);
var fl = _a.b;
var revfl = _a.r;
fl[28] = 258, revfl[258] = 28;
var _b = freb(fdeb, 0);
var fd = _b.b;
var revfd = _b.r;
var rev = new u16(32768);
for (i = 0;i < 32768; ++i) {
  x = (i & 43690) >> 1 | (i & 21845) << 1;
  x = (x & 52428) >> 2 | (x & 13107) << 2;
  x = (x & 61680) >> 4 | (x & 3855) << 4;
  rev[i] = ((x & 65280) >> 8 | (x & 255) << 8) >> 1;
}
var x;
var i;
var hMap = function(cd, mb, r) {
  var s = cd.length;
  var i2 = 0;
  var l = new u16(mb);
  for (;i2 < s; ++i2) {
    if (cd[i2])
      ++l[cd[i2] - 1];
  }
  var le = new u16(mb);
  for (i2 = 1;i2 < mb; ++i2) {
    le[i2] = le[i2 - 1] + l[i2 - 1] << 1;
  }
  var co;
  if (r) {
    co = new u16(1 << mb);
    var rvb = 15 - mb;
    for (i2 = 0;i2 < s; ++i2) {
      if (cd[i2]) {
        var sv = i2 << 4 | cd[i2];
        var r_1 = mb - cd[i2];
        var v = le[cd[i2] - 1]++ << r_1;
        for (var m = v | (1 << r_1) - 1;v <= m; ++v) {
          co[rev[v] >> rvb] = sv;
        }
      }
    }
  } else {
    co = new u16(s);
    for (i2 = 0;i2 < s; ++i2) {
      if (cd[i2]) {
        co[i2] = rev[le[cd[i2] - 1]++] >> 15 - cd[i2];
      }
    }
  }
  return co;
};
var flt = new u8(288);
for (i = 0;i < 144; ++i)
  flt[i] = 8;
var i;
for (i = 144;i < 256; ++i)
  flt[i] = 9;
var i;
for (i = 256;i < 280; ++i)
  flt[i] = 7;
var i;
for (i = 280;i < 288; ++i)
  flt[i] = 8;
var i;
var fdt = new u8(32);
for (i = 0;i < 32; ++i)
  fdt[i] = 5;
var i;
var flm = /* @__PURE__ */ hMap(flt, 9, 0);
var fdm = /* @__PURE__ */ hMap(fdt, 5, 0);
var shft = function(p) {
  return (p + 7) / 8 | 0;
};
var slc = function(v, s, e) {
  if (s == null || s < 0)
    s = 0;
  if (e == null || e > v.length)
    e = v.length;
  return new u8(v.subarray(s, e));
};
var ec = [
  "unexpected EOF",
  "invalid block type",
  "invalid length/literal",
  "invalid distance",
  "stream finished",
  "no stream handler",
  ,
  "no callback",
  "invalid UTF-8 data",
  "extra field too long",
  "date not in range 1980-2099",
  "filename too long",
  "stream finishing",
  "invalid zip data"
];
var err = function(ind, msg, nt) {
  var e = new Error(msg || ec[ind]);
  e.code = ind;
  if (Error.captureStackTrace)
    Error.captureStackTrace(e, err);
  if (!nt)
    throw e;
  return e;
};
var wbits = function(d, p, v) {
  v <<= p & 7;
  var o = p / 8 | 0;
  d[o] |= v;
  d[o + 1] |= v >> 8;
};
var wbits16 = function(d, p, v) {
  v <<= p & 7;
  var o = p / 8 | 0;
  d[o] |= v;
  d[o + 1] |= v >> 8;
  d[o + 2] |= v >> 16;
};
var hTree = function(d, mb) {
  var t = [];
  for (var i2 = 0;i2 < d.length; ++i2) {
    if (d[i2])
      t.push({ s: i2, f: d[i2] });
  }
  var s = t.length;
  var t2 = t.slice();
  if (!s)
    return { t: et, l: 0 };
  if (s == 1) {
    var v = new u8(t[0].s + 1);
    v[t[0].s] = 1;
    return { t: v, l: 1 };
  }
  t.sort(function(a, b) {
    return a.f - b.f;
  });
  t.push({ s: -1, f: 25001 });
  var l = t[0], r = t[1], i0 = 0, i1 = 1, i22 = 2;
  t[0] = { s: -1, f: l.f + r.f, l, r };
  while (i1 != s - 1) {
    l = t[t[i0].f < t[i22].f ? i0++ : i22++];
    r = t[i0 != i1 && t[i0].f < t[i22].f ? i0++ : i22++];
    t[i1++] = { s: -1, f: l.f + r.f, l, r };
  }
  var maxSym = t2[0].s;
  for (var i2 = 1;i2 < s; ++i2) {
    if (t2[i2].s > maxSym)
      maxSym = t2[i2].s;
  }
  var tr = new u16(maxSym + 1);
  var mbt = ln(t[i1 - 1], tr, 0);
  if (mbt > mb) {
    var i2 = 0, dt = 0;
    var lft = mbt - mb, cst = 1 << lft;
    t2.sort(function(a, b) {
      return tr[b.s] - tr[a.s] || a.f - b.f;
    });
    for (;i2 < s; ++i2) {
      var i2_1 = t2[i2].s;
      if (tr[i2_1] > mb) {
        dt += cst - (1 << mbt - tr[i2_1]);
        tr[i2_1] = mb;
      } else
        break;
    }
    dt >>= lft;
    while (dt > 0) {
      var i2_2 = t2[i2].s;
      if (tr[i2_2] < mb)
        dt -= 1 << mb - tr[i2_2]++ - 1;
      else
        ++i2;
    }
    for (;i2 >= 0 && dt; --i2) {
      var i2_3 = t2[i2].s;
      if (tr[i2_3] == mb) {
        --tr[i2_3];
        ++dt;
      }
    }
    mbt = mb;
  }
  return { t: new u8(tr), l: mbt };
};
var ln = function(n, l, d) {
  return n.s == -1 ? Math.max(ln(n.l, l, d + 1), ln(n.r, l, d + 1)) : l[n.s] = d;
};
var lc = function(c) {
  var s = c.length;
  while (s && !c[--s])
    ;
  var cl = new u16(++s);
  var cli = 0, cln = c[0], cls = 1;
  var w = function(v) {
    cl[cli++] = v;
  };
  for (var i2 = 1;i2 <= s; ++i2) {
    if (c[i2] == cln && i2 != s)
      ++cls;
    else {
      if (!cln && cls > 2) {
        for (;cls > 138; cls -= 138)
          w(32754);
        if (cls > 2) {
          w(cls > 10 ? cls - 11 << 5 | 28690 : cls - 3 << 5 | 12305);
          cls = 0;
        }
      } else if (cls > 3) {
        w(cln), --cls;
        for (;cls > 6; cls -= 6)
          w(8304);
        if (cls > 2)
          w(cls - 3 << 5 | 8208), cls = 0;
      }
      while (cls--)
        w(cln);
      cls = 1;
      cln = c[i2];
    }
  }
  return { c: cl.subarray(0, cli), n: s };
};
var clen = function(cf, cl) {
  var l = 0;
  for (var i2 = 0;i2 < cl.length; ++i2)
    l += cf[i2] * cl[i2];
  return l;
};
var wfblk = function(out, pos, dat) {
  var s = dat.length;
  var o = shft(pos + 2);
  out[o] = s & 255;
  out[o + 1] = s >> 8;
  out[o + 2] = out[o] ^ 255;
  out[o + 3] = out[o + 1] ^ 255;
  for (var i2 = 0;i2 < s; ++i2)
    out[o + i2 + 4] = dat[i2];
  return (o + 4 + s) * 8;
};
var wblk = function(dat, out, final, syms, lf, df, eb, li, bs, bl, p) {
  wbits(out, p++, final);
  ++lf[256];
  var _a2 = hTree(lf, 15), dlt = _a2.t, mlb = _a2.l;
  var _b2 = hTree(df, 15), ddt = _b2.t, mdb = _b2.l;
  var _c = lc(dlt), lclt = _c.c, nlc = _c.n;
  var _d = lc(ddt), lcdt = _d.c, ndc = _d.n;
  var lcfreq = new u16(19);
  for (var i2 = 0;i2 < lclt.length; ++i2)
    ++lcfreq[lclt[i2] & 31];
  for (var i2 = 0;i2 < lcdt.length; ++i2)
    ++lcfreq[lcdt[i2] & 31];
  var _e = hTree(lcfreq, 7), lct = _e.t, mlcb = _e.l;
  var nlcc = 19;
  for (;nlcc > 4 && !lct[clim[nlcc - 1]]; --nlcc)
    ;
  var flen = bl + 5 << 3;
  var ftlen = clen(lf, flt) + clen(df, fdt) + eb;
  var dtlen = clen(lf, dlt) + clen(df, ddt) + eb + 14 + 3 * nlcc + clen(lcfreq, lct) + 2 * lcfreq[16] + 3 * lcfreq[17] + 7 * lcfreq[18];
  if (bs >= 0 && flen <= ftlen && flen <= dtlen)
    return wfblk(out, p, dat.subarray(bs, bs + bl));
  var lm, ll, dm, dl;
  wbits(out, p, 1 + (dtlen < ftlen)), p += 2;
  if (dtlen < ftlen) {
    lm = hMap(dlt, mlb, 0), ll = dlt, dm = hMap(ddt, mdb, 0), dl = ddt;
    var llm = hMap(lct, mlcb, 0);
    wbits(out, p, nlc - 257);
    wbits(out, p + 5, ndc - 1);
    wbits(out, p + 10, nlcc - 4);
    p += 14;
    for (var i2 = 0;i2 < nlcc; ++i2)
      wbits(out, p + 3 * i2, lct[clim[i2]]);
    p += 3 * nlcc;
    var lcts = [lclt, lcdt];
    for (var it = 0;it < 2; ++it) {
      var clct = lcts[it];
      for (var i2 = 0;i2 < clct.length; ++i2) {
        var len = clct[i2] & 31;
        wbits(out, p, llm[len]), p += lct[len];
        if (len > 15)
          wbits(out, p, clct[i2] >> 5 & 127), p += clct[i2] >> 12;
      }
    }
  } else {
    lm = flm, ll = flt, dm = fdm, dl = fdt;
  }
  for (var i2 = 0;i2 < li; ++i2) {
    var sym = syms[i2];
    if (sym > 255) {
      var len = sym >> 18 & 31;
      wbits16(out, p, lm[len + 257]), p += ll[len + 257];
      if (len > 7)
        wbits(out, p, sym >> 23 & 31), p += fleb[len];
      var dst = sym & 31;
      wbits16(out, p, dm[dst]), p += dl[dst];
      if (dst > 3)
        wbits16(out, p, sym >> 5 & 8191), p += fdeb[dst];
    } else {
      wbits16(out, p, lm[sym]), p += ll[sym];
    }
  }
  wbits16(out, p, lm[256]);
  return p + ll[256];
};
var deo = /* @__PURE__ */ new i32([65540, 131080, 131088, 131104, 262176, 1048704, 1048832, 2114560, 2117632]);
var et = /* @__PURE__ */ new u8(0);
var dflt = function(dat, lvl, plvl, pre, post, st) {
  var s = st.z || dat.length;
  var o = new u8(pre + s + 5 * (1 + Math.ceil(s / 7000)) + post);
  var w = o.subarray(pre, o.length - post);
  var lst = st.l;
  var pos = (st.r || 0) & 7;
  if (lvl) {
    if (pos)
      w[0] = st.r >> 3;
    var opt = deo[lvl - 1];
    var n = opt >> 13, c = opt & 8191;
    var msk_1 = (1 << plvl) - 1;
    var prev = st.p || new u16(32768), head = st.h || new u16(msk_1 + 1);
    var bs1_1 = Math.ceil(plvl / 3), bs2_1 = 2 * bs1_1;
    var hsh = function(i3) {
      return (dat[i3] ^ dat[i3 + 1] << bs1_1 ^ dat[i3 + 2] << bs2_1) & msk_1;
    };
    var syms = new i32(25000);
    var lf = new u16(288), df = new u16(32);
    var lc_1 = 0, eb = 0, i2 = st.i || 0, li = 0, wi = st.w || 0, bs = 0;
    for (;i2 + 2 < s; ++i2) {
      var hv = hsh(i2);
      var imod = i2 & 32767, pimod = head[hv];
      prev[imod] = pimod;
      head[hv] = imod;
      if (wi <= i2) {
        var rem = s - i2;
        if ((lc_1 > 7000 || li > 24576) && (rem > 423 || !lst)) {
          pos = wblk(dat, w, 0, syms, lf, df, eb, li, bs, i2 - bs, pos);
          li = lc_1 = eb = 0, bs = i2;
          for (var j = 0;j < 286; ++j)
            lf[j] = 0;
          for (var j = 0;j < 30; ++j)
            df[j] = 0;
        }
        var l = 2, d = 0, ch_1 = c, dif = imod - pimod & 32767;
        if (rem > 2 && hv == hsh(i2 - dif)) {
          var maxn = Math.min(n, rem) - 1;
          var maxd = Math.min(32767, i2);
          var ml = Math.min(258, rem);
          while (dif <= maxd && --ch_1 && imod != pimod) {
            if (dat[i2 + l] == dat[i2 + l - dif]) {
              var nl = 0;
              for (;nl < ml && dat[i2 + nl] == dat[i2 + nl - dif]; ++nl)
                ;
              if (nl > l) {
                l = nl, d = dif;
                if (nl > maxn)
                  break;
                var mmd = Math.min(dif, nl - 2);
                var md = 0;
                for (var j = 0;j < mmd; ++j) {
                  var ti = i2 - dif + j & 32767;
                  var pti = prev[ti];
                  var cd = ti - pti & 32767;
                  if (cd > md)
                    md = cd, pimod = ti;
                }
              }
            }
            imod = pimod, pimod = prev[imod];
            dif += imod - pimod & 32767;
          }
        }
        if (d) {
          syms[li++] = 268435456 | revfl[l] << 18 | revfd[d];
          var lin = revfl[l] & 31, din = revfd[d] & 31;
          eb += fleb[lin] + fdeb[din];
          ++lf[257 + lin];
          ++df[din];
          wi = i2 + l;
          ++lc_1;
        } else {
          syms[li++] = dat[i2];
          ++lf[dat[i2]];
        }
      }
    }
    for (i2 = Math.max(i2, wi);i2 < s; ++i2) {
      syms[li++] = dat[i2];
      ++lf[dat[i2]];
    }
    pos = wblk(dat, w, lst, syms, lf, df, eb, li, bs, i2 - bs, pos);
    if (!lst) {
      st.r = pos & 7 | w[pos / 8 | 0] << 3;
      pos -= 7;
      st.h = head, st.p = prev, st.i = i2, st.w = wi;
    }
  } else {
    for (var i2 = st.w || 0;i2 < s + lst; i2 += 65535) {
      var e = i2 + 65535;
      if (e >= s) {
        w[pos / 8 | 0] = lst;
        e = s;
      }
      pos = wfblk(w, pos + 1, dat.subarray(i2, e));
    }
    st.i = s;
  }
  return slc(o, 0, pre + shft(pos) + post);
};
var crct = /* @__PURE__ */ function() {
  var t = new Int32Array(256);
  for (var i2 = 0;i2 < 256; ++i2) {
    var c = i2, k = 9;
    while (--k)
      c = (c & 1 && -306674912) ^ c >>> 1;
    t[i2] = c;
  }
  return t;
}();
var crc = function() {
  var c = -1;
  return {
    p: function(d) {
      var cr = c;
      for (var i2 = 0;i2 < d.length; ++i2)
        cr = crct[cr & 255 ^ d[i2]] ^ cr >>> 8;
      c = cr;
    },
    d: function() {
      return ~c;
    }
  };
};
var dopt = function(dat, opt, pre, post, st) {
  if (!st) {
    st = { l: 1 };
    if (opt.dictionary) {
      var dict = opt.dictionary.subarray(-32768);
      var newDat = new u8(dict.length + dat.length);
      newDat.set(dict);
      newDat.set(dat, dict.length);
      dat = newDat;
      st.w = dict.length;
    }
  }
  return dflt(dat, opt.level == null ? 6 : opt.level, opt.mem == null ? st.l ? Math.ceil(Math.max(8, Math.min(13, Math.log(dat.length))) * 1.5) : 20 : 12 + opt.mem, pre, post, st);
};
var mrg = function(a, b) {
  var o = {};
  for (var k in a)
    o[k] = a[k];
  for (var k in b)
    o[k] = b[k];
  return o;
};
var wbytes = function(d, b, v) {
  for (;v; ++b)
    d[b] = v, v >>>= 8;
};
function deflateSync(data, opts) {
  return dopt(data, opts || {}, 0, 0);
}
var fltn = function(d, p, t, o) {
  for (var k in d) {
    var val = d[k], n = p + k, op = o;
    if (Array.isArray(val))
      op = mrg(o, val[1]), val = val[0];
    if (ArrayBuffer.isView(val))
      t[n] = [val, op];
    else {
      t[n += "/"] = [new u8(0), op];
      fltn(val, n, t, o);
    }
  }
};
var te = typeof TextEncoder != "undefined" && /* @__PURE__ */ new TextEncoder;
var td = typeof TextDecoder != "undefined" && /* @__PURE__ */ new TextDecoder;
var tds = 0;
try {
  td.decode(et, { stream: true });
  tds = 1;
} catch (e) {}
function strToU8(str, latin1) {
  if (latin1) {
    var ar_1 = new u8(str.length);
    for (var i2 = 0;i2 < str.length; ++i2)
      ar_1[i2] = str.charCodeAt(i2);
    return ar_1;
  }
  if (te)
    return te.encode(str);
  var l = str.length;
  var ar = new u8(str.length + (str.length >> 1));
  var ai = 0;
  var w = function(v) {
    ar[ai++] = v;
  };
  for (var i2 = 0;i2 < l; ++i2) {
    if (ai + 5 > ar.length) {
      var n = new u8(ai + 8 + (l - i2 << 1));
      n.set(ar);
      ar = n;
    }
    var c = str.charCodeAt(i2);
    if (c < 128 || latin1)
      w(c);
    else if (c < 2048)
      w(192 | c >> 6), w(128 | c & 63);
    else if (c > 55295 && c < 57344)
      c = 65536 + (c & 1023 << 10) | str.charCodeAt(++i2) & 1023, w(240 | c >> 18), w(128 | c >> 12 & 63), w(128 | c >> 6 & 63), w(128 | c & 63);
    else
      w(224 | c >> 12), w(128 | c >> 6 & 63), w(128 | c & 63);
  }
  return slc(ar, 0, ai);
}
var exfl = function(ex) {
  var le = 0;
  if (ex) {
    for (var k in ex) {
      var l = ex[k].length;
      if (l > 65535)
        err(9);
      le += l + 4;
    }
  }
  return le;
};
var wzh = function(d, b, f, fn, u, c, ce, co) {
  var fl2 = fn.length, ex = f.extra, col = co && co.length;
  var exl = exfl(ex);
  wbytes(d, b, ce != null ? 33639248 : 67324752), b += 4;
  if (ce != null)
    d[b++] = 20, d[b++] = f.os;
  d[b] = 20, b += 2;
  d[b++] = f.flag << 1 | (c < 0 && 8), d[b++] = u && 8;
  d[b++] = f.compression & 255, d[b++] = f.compression >> 8;
  var dt = new Date(f.mtime == null ? Date.now() : f.mtime), y = dt.getFullYear() - 1980;
  if (y < 0 || y > 119)
    err(10);
  wbytes(d, b, y << 25 | dt.getMonth() + 1 << 21 | dt.getDate() << 16 | dt.getHours() << 11 | dt.getMinutes() << 5 | dt.getSeconds() >> 1), b += 4;
  if (c != -1) {
    wbytes(d, b, f.crc);
    wbytes(d, b + 4, c < 0 ? -c - 2 : c);
    wbytes(d, b + 8, f.size);
  }
  wbytes(d, b + 12, fl2);
  wbytes(d, b + 14, exl), b += 16;
  if (ce != null) {
    wbytes(d, b, col);
    wbytes(d, b + 6, f.attrs);
    wbytes(d, b + 10, ce), b += 14;
  }
  d.set(fn, b);
  b += fl2;
  if (exl) {
    for (var k in ex) {
      var exf = ex[k], l = exf.length;
      wbytes(d, b, +k);
      wbytes(d, b + 2, l);
      d.set(exf, b + 4), b += 4 + l;
    }
  }
  if (col)
    d.set(co, b), b += col;
  return b;
};
var wzf = function(o, b, c, d, e) {
  wbytes(o, b, 101010256);
  wbytes(o, b + 8, c);
  wbytes(o, b + 10, c);
  wbytes(o, b + 12, d);
  wbytes(o, b + 16, e);
};
function zipSync(data, opts) {
  if (!opts)
    opts = {};
  var r = {};
  var files = [];
  fltn(data, "", r, opts);
  var o = 0;
  var tot = 0;
  for (var fn in r) {
    var _a2 = r[fn], file = _a2[0], p = _a2[1];
    var compression = p.level == 0 ? 0 : 8;
    var f = strToU8(fn), s = f.length;
    var com = p.comment, m = com && strToU8(com), ms = m && m.length;
    var exl = exfl(p.extra);
    if (s > 65535)
      err(11);
    var d = compression ? deflateSync(file, p) : file, l = d.length;
    var c = crc();
    c.p(file);
    files.push(mrg(p, {
      size: file.length,
      crc: c.d(),
      c: d,
      f,
      m,
      u: s != fn.length || m && com.length != ms,
      o,
      compression
    }));
    o += 30 + s + exl + l;
    tot += 76 + 2 * (s + exl) + (ms || 0) + l;
  }
  var out = new u8(tot + 22), oe = o, cdl = tot - o;
  for (var i2 = 0;i2 < files.length; ++i2) {
    var f = files[i2];
    wzh(out, f.o, f, f.f, f.u, f.c.length);
    var badd = 30 + f.f.length + exfl(f.extra);
    out.set(f.c, f.o + badd);
    wzh(out, o, f, f.f, f.u, f.c.length, f.o, f.m), o += 16 + badd + (f.m ? f.m.length : 0);
  }
  wzf(out, o, files.length, cdl, oe);
  return out;
}

// src/studio/settings-shape.ts
var SETTING_KEYS = {
  theme: "theme",
  firstDeck: "firstDeck",
  makes: "makes",
  publishTargets: "publishTargets",
  houseAccent: "houseAccent",
  homeApp: "homeApp",
  workbenchFollow: "workbench.follow",
  workbenchRecents: "workbench.recents",
  dockSlim: "shell.dockSlim",
  remoteAccessEnabled: "remoteAccessEnabled"
};

// src/core/media/pack.ts
var str = (v) => typeof v === "string" ? v : "";
var normalizeLabel = (raw) => raw.trim().replace(/\.[a-z0-9]+$/i, "").replace(/^(expr_|expression_|full_)/i, "").replace(/[\s_/-]+/g, " ").trim().toLowerCase();
var emptyPack = () => ({ items: [] });
var newPackItemId = () => `sp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
function normalizePack(value) {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return emptyPack();
  const v = value;
  const rawItems = Array.isArray(v.items) ? v.items : [];
  const byNorm = new Map;
  for (const row of rawItems) {
    if (!row || typeof row !== "object" || Array.isArray(row))
      continue;
    const r = row;
    const label = str(r.label).trim();
    const ref = str(r.ref).trim();
    if (!label || !ref)
      continue;
    const id = str(r.id).trim() || newPackItemId();
    const mime = str(r.mime).trim();
    const item = { id, label, ref };
    if (mime)
      item.mime = mime;
    byNorm.set(normalizeLabel(label), item);
  }
  const items = [...byNorm.values()];
  const out = { items };
  if (v.enabled === true)
    out.enabled = true;
  if (v.enabled === false)
    out.enabled = false;
  const def = str(v.defaultLabel).trim();
  if (def && items.some((i2) => normalizeLabel(i2.label) === normalizeLabel(def))) {
    out.defaultLabel = items.find((i2) => normalizeLabel(i2.label) === normalizeLabel(def)).label;
  } else if (items.some((i2) => normalizeLabel(i2.label) === "neutral")) {
    out.defaultLabel = items.find((i2) => normalizeLabel(i2.label) === "neutral").label;
  }
  return out;
}
function packFromMedia(media) {
  if (!media)
    return emptyPack();
  const items = [];
  for (const a of media.assets ?? []) {
    if (a.role !== "emotion")
      continue;
    const label = (a.label ?? a.name ?? "").trim();
    const ref = (a.ref ?? "").trim();
    if (!label || !ref)
      continue;
    const item = { id: newPackItemId(), label, ref };
    if (a.mime)
      item.mime = a.mime;
    items.push(item);
  }
  return normalizePack({ items });
}

// src/core/media/summary.ts
var isRec = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var countAssetRows = (rows) => {
  if (!Array.isArray(rows))
    return 0;
  return rows.filter((row) => Array.isArray(row) && typeof row[0] === "string" && typeof row[1] === "string").length;
};
function countNamedFromOriginal(original) {
  if (!isRec(original))
    return 0;
  const risu = isRec(original.risu) ? original.risu : null;
  if (!risu)
    return 0;
  const top = countAssetRows(risu.additionalAssets);
  if (top > 0)
    return top;
  const raw = isRec(risu.raw) ? risu.raw : null;
  const data = raw && isRec(raw.data) ? raw.data : null;
  if (data) {
    const onData = countAssetRows(data.additionalAssets);
    if (onData > 0)
      return onData;
    const ext = isRec(data.extensions) ? data.extensions : null;
    const risuai = ext && isRec(ext.risuai) ? ext.risuai : null;
    if (risuai) {
      const onExt = countAssetRows(risuai.additionalAssets);
      if (onExt > 0)
        return onExt;
    }
    const assets = Array.isArray(data.assets) ? data.assets : [];
    let n = 0;
    for (const a of assets) {
      if (isRec(a) && a.type === "x-risu-asset" && typeof a.name === "string" && typeof a.uri === "string") {
        n++;
      }
    }
    if (n > 0)
      return n;
  }
  return 0;
}
function mediaExportSummary(body, original) {
  const b = isRec(body) ? body : {};
  const media = isRec(b.media) ? b.media : {};
  const pack = packFromMedia(media);
  const emotions = pack.items.length;
  const hasPortrait = Boolean(media.portrait && typeof media.portrait.ref === "string" && media.portrait.ref.trim());
  const named = countNamedFromOriginal(original);
  const chips = [];
  if (hasPortrait)
    chips.push("portrait");
  if (emotions > 0) {
    chips.push(`${emotions} emotion${emotions === 1 ? "" : "s"}`);
  }
  if (named > 0) {
    chips.push(`${named} named`);
  }
  return { emotions, named, hasPortrait, chips };
}
// src/ui/components/export-dialog/honesty.ts
var FORMAT_CAVEAT_TARGETS = new Set(["agnai", "backyard", "byaf", "lumiverse", "sillytavern"]);
var PACK_CARRIERS = new Set([
  "sillytavern",
  "rolecall",
  "risu",
  "lumiverse",
  "chub",
  "marinara",
  "byaf"
]);

// src/ui/_shared/download-name.ts
var FORBIDDEN_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;
var WINDOWS_DEVICE_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
function sanitizeDownloadBase(raw, fallback) {
  const normalized = (raw.trim() || fallback).replace(FORBIDDEN_FILENAME_CHARS, "_").slice(0, 80);
  const withoutTrailingDots = normalized.replace(/[. ]+$/g, "") || fallback;
  if (withoutTrailingDots === "." || withoutTrailingDots === "..")
    return `_${withoutTrailingDots}`;
  return WINDOWS_DEVICE_NAME.test(withoutTrailingDots) ? `_${withoutTrailingDots}` : withoutTrailingDots;
}

// src/ui/components/export-dialog/download.ts
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// src/formats/_shared/extension-platforms.ts
var DEFAULT_CCV3_ID = "default-ccv3";
var RETIRED_THIN_HOST_IDS = ["characterai", "crushon", "janitor"];
var retiredThin = new Set(RETIRED_THIN_HOST_IDS);
var EXTENSION_PLATFORMS = [
  {
    id: "marinara",
    label: "Marinara",
    carries: [
      "identity.name",
      "identity.description",
      "identity.characterVersion",
      "persona.personality",
      "persona.scenario",
      "persona.appearance",
      "prompts.systemPrompt",
      "prompts.postHistoryInstructions",
      "prompts.depthInjections",
      "greetings.firstMessage",
      "greetings.alternateGreetings",
      "examples.exampleMessages",
      "discovery.tags",
      "attribution.creator",
      "attribution.creatorNotes",
      "presentation.palette",
      "media.portrait",
      "media.sprite",
      "settings.talkativeness",
      "worldName",
      "knowledgeRefs"
    ],
    originalFields: [
      "backstory",
      "rpgStats.enabled",
      "rpgStats.attributes[] (STR/DEX/...)",
      "rpgStats.hp {value,max}",
      "avatarCrop",
      "trackerCardColors",
      "nameColor",
      "dialogueColor",
      "boxColor"
    ]
  },
  {
    id: "chub",
    label: "Chub",
    carries: [
      "identity.name",
      "identity.tagline",
      "identity.description",
      "persona.personality",
      "persona.scenario",
      "greetings.firstMessage",
      "greetings.alternateGreetings",
      "examples.exampleMessages",
      "discovery.tags",
      "attribution.creator",
      "attribution.publicNote",
      "media.portrait",
      "media.assets",
      "presentation.background",
      "prompts.depthInjections",
      "knowledgeRefs"
    ],
    originalFields: [
      "background_image",
      "related_lorebooks",
      "custom_css",
      "preset",
      "full_path",
      "id",
      "expressions",
      "alt_expressions",
      "extensions (Stages refs)"
    ]
  },
  {
    id: DEFAULT_CCV3_ID,
    label: "Default",
    carries: [
      "identity.name",
      "identity.description",
      "identity.characterVersion",
      "persona.personality",
      "persona.scenario",
      "greetings.firstMessage",
      "greetings.alternateGreetings",
      "examples.exampleMessages",
      "prompts.systemPrompt",
      "prompts.postHistoryInstructions",
      "attribution.creator",
      "attribution.creatorNotes",
      "discovery.tags",
      "media.portrait"
    ],
    notes: {
      "identity.name": "Portable CCv3 for thin hosts (Character.AI converters, Crushon import, Janitor PNG, generic cards). Export via SillyTavern path."
    },
    originalFields: []
  }
];

// src/ui/apps/press/press-core.ts
function groupPlatforms(formats) {
  const byFriendly = new Map;
  for (const f of formats) {
    if (f.native)
      continue;
    const entry = byFriendly.get(f.friendly) ?? { friendly: f.friendly, byKind: {} };
    if (entry.byKind[f.kind] === undefined)
      entry.byKind[f.kind] = f;
    byFriendly.set(f.friendly, entry);
  }
  const card = formats.find((f) => f.id === "sillytavern" && f.kind === "character");
  if (card) {
    for (const host of EXTENSION_PLATFORMS) {
      const entry = byFriendly.get(host.label);
      if (!entry || entry.byKind.character !== undefined)
        continue;
      entry.byKind.character = card;
      entry.borrowed = { ...entry.borrowed ?? {}, character: "a CCv3 card, its native character file" };
    }
  }
  return [...byFriendly.values()].sort((a, b) => a.friendly.localeCompare(b.friendly));
}
function planRun(picked, platform) {
  return picked.map((p) => {
    const adapter = platform.byKind[p.kind];
    if (!adapter) {
      return {
        id: p.id,
        kind: p.kind,
        name: p.name,
        status: "skip",
        note: `${platform.friendly} has no ${p.kind} format`
      };
    }
    const borrowed = platform.borrowed?.[p.kind];
    return {
      id: p.id,
      kind: p.kind,
      name: p.name,
      status: "wait",
      targetId: adapter.id,
      ...borrowed ? { info: `prints as ${borrowed}` } : {}
    };
  });
}
function mintFilename(name, extension, taken) {
  const ext = extension.replace(/^\./, "") || "bin";
  const base = sanitizeDownloadBase(name, "piece");
  let candidate = `${base}.${ext}`;
  for (let n = 2;taken.has(candidate); n++)
    candidate = `${base}-${n}.${ext}`;
  taken.add(candidate);
  return candidate;
}
function payloadBytes(payload) {
  if (typeof payload.text === "string")
    return new TextEncoder().encode(payload.text);
  if (payload.bytesB64) {
    const bin = atob(payload.bytesB64);
    const bytes = new Uint8Array(bin.length);
    for (let i2 = 0;i2 < bin.length; i2++)
      bytes[i2] = bin.charCodeAt(i2);
    return bytes;
  }
  return null;
}
function foldSummary(rows) {
  if (rows.length === 0)
    return "nothing picked yet";
  const count = (s) => rows.filter((r) => r.status === s).length;
  const waiting = count("wait");
  const bits = [];
  const printed = count("ok") + count("warn");
  if (printed > 0)
    bits.push(`${printed} printed`);
  if (count("warn") > 0)
    bits.push(`${count("warn")} with notes`);
  if (count("fail") > 0)
    bits.push(`${count("fail")} failed`);
  if (count("skip") > 0)
    bits.push(`${count("skip")} skipped`);
  if (waiting > 0)
    bits.push(`${waiting} waiting`);
  return bits.length > 0 ? bits.join(" · ") : `${rows.length} on the sheet`;
}
var flavorChoosable = (normalExt) => {
  const e = normalExt.replace(/^\./, "").toLowerCase();
  return e === "json" || e === "txt" || e === "md";
};
var flavorExtension = (normalExt, flavor) => flavor === "normal" ? normalExt : flavor;

// src/ui/apps/press/readiness-core.ts
var isRec2 = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
function readBodyPath(body, dotPath) {
  let cur = body;
  for (const key of dotPath.split(".")) {
    if (!isRec2(cur))
      return;
    cur = cur[key];
  }
  return cur;
}
function isFilled(v) {
  if (v === undefined || v === null || v === false)
    return false;
  if (typeof v === "string")
    return v.trim() !== "";
  if (Array.isArray(v))
    return v.length > 0;
  if (isRec2(v))
    return Object.values(v).some(isFilled);
  return true;
}
var pathName = (p) => (p.split(".").pop() ?? p).replace(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase();
function readiness(body, coverage) {
  if (!coverage || coverage.carries.length === 0) {
    return { filled: [], empty: [], emptyNames: [], verdict: "unknown" };
  }
  const filled = [];
  const empty = [];
  for (const path of coverage.carries) {
    (isFilled(readBodyPath(body, path)) ? filled : empty).push(path);
  }
  return {
    filled,
    empty,
    emptyNames: empty.map(pathName),
    verdict: empty.length === 0 ? "ready" : "empties"
  };
}
function readinessLine(r, maxNamed = 3) {
  if (r.verdict === "unknown")
    return "no coverage claims for this platform";
  const total = r.filled.length + r.empty.length;
  if (r.verdict === "ready")
    return `${total} of ${total} filled - everything carried is set`;
  const named = r.emptyNames.slice(0, maxNamed).join(", ");
  const more = r.emptyNames.length - maxNamed;
  return `${r.filled.length} of ${total} filled - empty: ${named}${more > 0 ? `, +${more} more` : ""}`;
}
function lorebookKeyGap(body) {
  const b = isRec2(body) ? body : {};
  const entries = Array.isArray(b.entries) ? b.entries : [];
  let keyless = 0;
  for (const e of entries) {
    if (!isRec2(e))
      continue;
    const triggers = Array.isArray(e.triggers) ? e.triggers : [];
    if (triggers.length === 0 && e.constant !== true)
      keyless++;
  }
  return { total: entries.length, keyless };
}

// src/ui/apps/press/press-bundles.ts
var isRec3 = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var pieceKeyOf = (p) => `${p.kind}:${p.id}`;
var stringRefs = (raw) => Array.isArray(raw) ? raw.filter((r) => typeof r === "string") : [];
function riderRefsOf(owner, entity) {
  if (!isRec3(entity) || !isRec3(entity.body))
    return [];
  if (owner.kind === "character") {
    return stringRefs(entity.body.knowledgeRefs).map((id) => ({ kind: "lorebook", id }));
  }
  if (owner.kind === "preset") {
    return [
      ...stringRefs(entity.body.behaviorRefs).map((id) => ({ kind: "regex", id })),
      ...stringRefs(entity.body.quickReplyRefs).map((id) => ({ kind: "quickreply", id }))
    ];
  }
  return [];
}
var OWNER_KINDS = new Set(["character", "preset"]);
function groupBundles(queue, allSummaries, refsByOwner) {
  const bundles = [];
  const ridden = new Set;
  for (const p of queue) {
    if (!OWNER_KINDS.has(p.kind))
      continue;
    const refs = refsByOwner[pieceKeyOf(p)] ?? [];
    const riders = refs.map((ref) => allSummaries.find((s) => s.kind === ref.kind && s.id === ref.id)).filter((s) => s !== undefined);
    for (const r of riders)
      ridden.add(pieceKeyOf(r));
    bundles.push({ owner: p, riders });
  }
  const solos = queue.filter((p) => !OWNER_KINDS.has(p.kind) && !ridden.has(pieceKeyOf(p)));
  return { bundles, solos };
}
function runSet(grouping, dropped) {
  const out = [];
  for (const bundle of grouping.bundles) {
    out.push(bundle.owner);
    for (const r of bundle.riders)
      if (!dropped.has(pieceKeyOf(r)))
        out.push(r);
  }
  for (const s of grouping.solos)
    out.push(s);
  return out;
}
function packageRun(files) {
  const names = Object.keys(files);
  if (names.length === 0)
    return null;
  if (names.length === 1) {
    const name = names[0];
    return { kind: "single", filename: name, bytes: files[name] };
  }
  return { kind: "zip", files: { ...files } };
}

// src/ui/apps/press/agent-surface.ts
import { useEffect, useRef } from "react";
var PRESS_AGENT_SURFACE = {
  describe: "The staged conversion queue. Pieces are staged here from the Library, one target platform is " + "chosen for the whole run, and the run prints them into a single zip.",
  actions: [
    {
      id: "explain-readiness",
      label: "Explain what a run will cost",
      describe: "Say what the chosen platform will carry and what it will drop for a staged piece, before " + "the run happens rather than after."
    },
    {
      id: "choose-target",
      label: "Help choose a target",
      describe: "Say which platform suits what is staged, and which staged kinds it cannot print at all."
    }
  ]
};
function pressAgentState(input) {
  const notes = [];
  if (input.loadFailed) {
    notes.push("The studio could not be reached, so the target platforms and every readiness check on this " + "screen may be missing rather than clean.");
  }
  if (input.target === "") {
    notes.push("No target platform is chosen yet, so nothing can print until one is picked.");
  }
  if (input.rows) {
    notes.push(input.running ? `A run is printing now: ${foldSummary(input.rows)}.` : `The last run: ${foldSummary(input.rows)}.`);
    const troubled = input.rows.filter((r) => r.status === "fail" || r.status === "skip");
    if (troubled.length > 0) {
      notes.push(`${String(troubled.length)} row(s) did not print: ` + troubled.map((r) => `${r.kind}/${r.id} (${r.status}${r.note ? `: ${r.note}` : ""})`).join(", "));
    }
  }
  if (input.zipReady) {
    notes.push("A finished bundle is waiting on the sheet and has not been downloaded yet.");
  }
  if (input.queue.length === 0) {
    notes.push("Nothing is staged. Pieces are staged from the Library, not browsed for in here.");
  }
  return {
    headline: input.queue.length === 0 ? "The Press, with nothing staged." : input.target === "" ? `The Press, ${String(input.queue.length)} piece(s) staged, no target platform chosen.` : `The Press, ${String(input.queue.length)} piece(s) staged, set to print for ${input.target}.`,
    items: input.queue.map((p) => ({ kind: p.kind, id: p.id, name: p.name })),
    notes
  };
}
function usePublishPressSurface(ctx, input) {
  const { queue, target, rows, running, zipReady, loadFailed } = input;
  const queueKey = queue.map(pieceKeyOf).join(",");
  const rowsKey = rows ? rows.map((r) => `${r.kind}:${r.id}:${r.status}`).join(",") : "";
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;
  useEffect(() => {
    ctxRef.current.agent.publish(pressAgentState({ queue, target, rows, running, zipReady, loadFailed }));
  }, [queueKey, rowsKey, target, running, zipReady, loadFailed]);
}

// src/ui/apps/press/styles.module.css
var styles_module_default = {
  roomHost: "roomHost_ZxwmOQ",
  room2: "room2_ZxwmOQ",
  rail: "rail_ZxwmOQ",
  kick: "kick_ZxwmOQ",
  offerList: "offerList_ZxwmOQ",
  offer: "offer_ZxwmOQ",
  offerName: "offerName_ZxwmOQ",
  bundle: "bundle_ZxwmOQ",
  bundleMarq: "bundleMarq_ZxwmOQ",
  unstage: "unstage_ZxwmOQ",
  kcard: "kcard_ZxwmOQ",
  kcardDropped: "kcardDropped_ZxwmOQ",
  kname: "kname_ZxwmOQ",
  riderDrop: "riderDrop_ZxwmOQ",
  fixLink: "fixLink_ZxwmOQ",
  sheetHead: "sheetHead_ZxwmOQ",
  targets: "targets_ZxwmOQ",
  tchip: "tchip_ZxwmOQ",
  tchipOn: "tchipOn_ZxwmOQ",
  fileEdit: "fileEdit_ZxwmOQ",
  fileIn: "fileIn_ZxwmOQ",
  flavor: "flavor_ZxwmOQ",
  flavorOn: "flavorOn_ZxwmOQ",
  jkind: "jkind_ZxwmOQ",
  jfile: "jfile_ZxwmOQ",
  dot: "dot_ZxwmOQ",
  dotOk: "dotOk_ZxwmOQ",
  dotWarn: "dotWarn_ZxwmOQ",
  dotFail: "dotFail_ZxwmOQ",
  jnote: "jnote_ZxwmOQ",
  jnoteFail: "jnoteFail_ZxwmOQ",
  jinfo: "jinfo_ZxwmOQ",
  empty: "empty_ZxwmOQ",
  foot: "foot_ZxwmOQ",
  sum: "sum_ZxwmOQ",
  stamp: "stamp_ZxwmOQ",
  stampRun: "stampRun_ZxwmOQ"
};

// src/ui/apps/press/index.tsx
import { jsxDEV, Fragment } from "react/jsx-dev-runtime";
var MARK_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">' + '<rect x="5" y="3" width="14" height="4"/><path d="M7 7v3.5M17 7v3.5"/>' + '<path d="m9 11.5 3 2.8 3-2.8"/><rect x="4" y="16.5" width="16" height="4.5"/>' + "</svg>";
var isRec4 = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
function Press({ ctx }) {
  const [queue, setQueue] = useState(() => ctx.press.queue());
  const [allSummaries, setAllSummaries] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [coverage, setCoverage] = useState([]);
  const [entities, setEntities] = useState({});
  const [dropped, setDropped] = useState(() => new Set);
  const [target, setTarget] = useState("");
  const [rows, setRows] = useState(null);
  const [running, setRunning] = useState(false);
  const [zip, setZip] = useState(null);
  const [fileNames, setFileNames] = useState({});
  const [flavors, setFlavors] = useState({});
  const [loadNote, setLoadNote] = useState(null);
  useEffect2(() => ctx.press.onChange(() => setQueue(ctx.press.queue())), [ctx]);
  useEffect2(() => {
    let cancelled = false;
    (async () => {
      try {
        const [list, formats, cov] = await Promise.all([
          ctx.api.listEntities(),
          ctx.api.formats(),
          ctx.api.coverage()
        ]);
        if (cancelled)
          return;
        setAllSummaries(list);
        const grouped = groupPlatforms(formats);
        setPlatforms(grouped);
        setCoverage(cov);
        const picksRaw = ctx.prefs.get(SETTING_KEYS.publishTargets);
        const picks = Array.isArray(picksRaw) ? picksRaw.filter((t) => typeof t === "string") : [];
        const preferred = picks.find((p) => grouped.some((g) => g.friendly === p));
        if (preferred)
          setTarget((t) => t === "" ? preferred : t);
      } catch {
        if (!cancelled)
          setLoadNote("could not load the studio · the server may be unreachable");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const refsByOwner = useMemo(() => {
    const out = {};
    for (const p of queue) {
      const refs = riderRefsOf(p, entities[pieceKeyOf(p)]);
      if (refs.length > 0)
        out[pieceKeyOf(p)] = refs;
    }
    return out;
  }, [queue, entities]);
  const grouping = useMemo(() => groupBundles(queue, allSummaries, refsByOwner), [queue, allSummaries, refsByOwner]);
  useEffect2(() => {
    let cancelled = false;
    (async () => {
      const wanted = [...queue, ...grouping.bundles.flatMap((k) => k.riders)];
      for (const p of wanted) {
        const key = pieceKeyOf(p);
        if (entities[key] !== undefined)
          continue;
        try {
          const e = await ctx.api.getEntity(`kind=${encodeURIComponent(p.kind)}&id=${encodeURIComponent(p.id)}`);
          if (cancelled)
            return;
          setEntities((prev) => ({ ...prev, [key]: e }));
        } catch {}
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [queue, grouping, ctx]);
  const platform = platforms.find((p) => p.friendly === target) ?? null;
  const set = useMemo(() => runSet(grouping, dropped), [grouping, dropped]);
  const staged = new Set(queue.map(pieceKeyOf));
  const offers = allSummaries.filter((s) => !staged.has(pieceKeyOf(s)));
  usePublishPressSurface(ctx, {
    queue,
    target,
    rows,
    running,
    zipReady: zip !== null,
    loadFailed: loadNote !== null
  });
  const covFor = (kind) => kind === "character" && platform ? coverage.find((c) => c.label === platform.friendly) ?? coverage.find((c) => c.id === platform.byKind.character?.id) : undefined;
  const readinessOf = (p) => {
    const entity = entities[pieceKeyOf(p)];
    if (entity === undefined)
      return { line: "reading the piece…", tone: "dim" };
    const body = isRec4(entity) ? entity.body : undefined;
    if (p.kind === "lorebook") {
      const gap = lorebookKeyGap(body);
      const entries = (n) => n === 1 ? "1 entry" : `${n} entries`;
      if (gap.total > 0 && gap.keyless === gap.total)
        return { line: "no entry has keywords - it will never fire", tone: "bad" };
      if (gap.keyless > 0)
        return { line: `${entries(gap.keyless)} of ${gap.total} without keywords`, tone: "warn" };
      return { line: `${entries(gap.total)} · keys fine`, tone: "ok" };
    }
    if (p.kind === "character" && platform) {
      const r = readiness(body, covFor(p.kind));
      if (r.verdict === "unknown")
        return null;
      return { line: readinessLine(r), tone: r.verdict === "ready" ? "ok" : "warn" };
    }
    return null;
  };
  const resetRun = () => {
    setRows(null);
    setZip(null);
  };
  const run = async () => {
    if (!platform || set.length === 0 || running)
      return;
    setRunning(true);
    setZip(null);
    const plan = planRun(set, platform);
    setRows([...plan]);
    const files = {};
    const taken = new Set;
    for (let i2 = 0;i2 < plan.length; i2++) {
      const row = plan[i2];
      if (row.status !== "wait" || !row.targetId)
        continue;
      const rowKey = `${row.kind}:${row.id}`;
      try {
        const entity = entities[rowKey] ?? await ctx.api.getEntity(`kind=${encodeURIComponent(row.kind)}&id=${encodeURIComponent(row.id)}`);
        const out = await ctx.api.exportEntity(entity, row.targetId);
        if (!out || isRec4(out) && "error" in out) {
          const msg = isRec4(out) && typeof out.error === "string" ? out.error : "export failed";
          throw new Error(msg);
        }
        const payload = out;
        const bytes = payloadBytes(payload);
        if (!bytes)
          throw new Error("empty export payload");
        const flavor = flavorChoosable(payload.suggestedExtension) ? flavors[rowKey] ?? "normal" : "normal";
        const filename = mintFilename(fileNames[rowKey]?.trim() || row.name, flavorExtension(payload.suggestedExtension, flavor), taken);
        files[filename] = bytes;
        const body = isRec4(entity) ? entity.body : undefined;
        const original = isRec4(entity) ? entity.original : undefined;
        const chips = row.kind === "character" ? mediaExportSummary(body, original).chips : [];
        const carries = chips.length > 0 ? `carries: ${chips.join(" · ")}` : undefined;
        const droppedCount = out.report.dropped.length;
        const reportLine = out.report.coverage === "unknown" ? `loss unknown${droppedCount > 0 ? `; at least ${droppedCount} field${droppedCount === 1 ? "" : "s"} not carried` : ""}` : droppedCount > 0 ? `${droppedCount} field${droppedCount === 1 ? "" : "s"} not carried` : out.report.warnings[0];
        plan[i2] = {
          ...row,
          status: reportLine ? "warn" : "ok",
          filename,
          info: [row.info, carries, reportLine].filter(Boolean).join(" · ") || undefined
        };
      } catch (e) {
        plan[i2] = { ...row, status: "fail", note: e instanceof Error ? e.message : String(e) };
      }
      setRows([...plan]);
    }
    const packed = packageRun(files);
    if (packed?.kind === "single") {
      setZip({ blob: new Blob([packed.bytes]), filename: packed.filename });
    } else if (packed) {
      const zipped = zipSync(packed.files);
      const stamp = platform.friendly.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      setZip({ blob: new Blob([zipped], { type: "application/zip" }), filename: `vaude-press-${stamp}.zip` });
    }
    ctx.setStatus(`press run · ${foldSummary(plan)}`);
    setRunning(false);
  };
  const rowFor = (r, p) => r?.find((x2) => x2.id === p.id && x2.kind === p.kind);
  const card = (p, rider) => {
    const key = pieceKeyOf(p);
    const ready = readinessOf(p);
    const row = rowFor(rows, p);
    const adapter = platform?.byKind[p.kind];
    const borrowed = platform?.borrowed?.[p.kind];
    const isDropped = rider !== undefined && dropped.has(key);
    return /* @__PURE__ */ jsxDEV("div", {
      className: `${styles_module_default.kcard}${isDropped ? ` ${styles_module_default.kcardDropped}` : ""}`,
      children: [
        /* @__PURE__ */ jsxDEV("span", {
          className: `${styles_module_default.dot}${row?.status === "ok" ? ` ${styles_module_default.dotOk}` : row?.status === "fail" ? ` ${styles_module_default.dotFail}` : ready?.tone === "ok" ? ` ${styles_module_default.dotOk}` : ready?.tone === "warn" ? ` ${styles_module_default.dotWarn}` : ready?.tone === "bad" ? ` ${styles_module_default.dotFail}` : ""}`
        }, undefined, false, undefined, this),
        /* @__PURE__ */ jsxDEV("b", {
          className: styles_module_default.kname,
          children: p.name
        }, undefined, false, undefined, this),
        /* @__PURE__ */ jsxDEV("span", {
          className: styles_module_default.jkind,
          children: [
            p.kind,
            rider ? " · rides with " + rider.of : "",
            borrowed ? " · prints as a CCv3 card" : ""
          ]
        }, undefined, true, undefined, this),
        rider && /* @__PURE__ */ jsxDEV("button", {
          type: "button",
          className: styles_module_default.riderDrop,
          onClick: () => {
            setDropped((prev) => {
              const next = new Set(prev);
              if (next.has(key))
                next.delete(key);
              else
                next.add(key);
              return next;
            });
            resetRun();
          },
          children: isDropped ? "ride again" : "drop from this run"
        }, undefined, false, undefined, this),
        !isDropped && ready && /* @__PURE__ */ jsxDEV("span", {
          className: `${styles_module_default.jinfo}${ready.tone === "warn" ? ` ${styles_module_default.jnote}` : ready.tone === "bad" ? ` ${styles_module_default.jnote} ${styles_module_default.jnoteFail}` : ""}`,
          children: [
            ready.line,
            ready.tone !== "ok" && ready.tone !== "dim" && /* @__PURE__ */ jsxDEV(Fragment, {
              children: [
                " · ",
                /* @__PURE__ */ jsxDEV("button", {
                  type: "button",
                  className: styles_module_default.fixLink,
                  onClick: () => ctx.workbench.send(p),
                  children: "open in the editor"
                }, undefined, false, undefined, this)
              ]
            }, undefined, true, undefined, this)
          ]
        }, undefined, true, undefined, this),
        row?.note && /* @__PURE__ */ jsxDEV("span", {
          className: `${styles_module_default.jnote} ${styles_module_default.jnoteFail}`,
          children: row.note
        }, undefined, false, undefined, this),
        row?.info && /* @__PURE__ */ jsxDEV("span", {
          className: styles_module_default.jinfo,
          children: row.info
        }, undefined, false, undefined, this),
        row?.filename && /* @__PURE__ */ jsxDEV("span", {
          className: styles_module_default.jfile,
          children: row.filename
        }, undefined, false, undefined, this),
        !isDropped && !rows && adapter && /* @__PURE__ */ jsxDEV("span", {
          className: styles_module_default.fileEdit,
          children: [
            /* @__PURE__ */ jsxDEV("input", {
              className: styles_module_default.fileIn,
              value: fileNames[key] ?? p.name,
              "aria-label": `filename for ${p.name}`,
              onChange: (e) => setFileNames((prev) => ({ ...prev, [key]: e.target.value }))
            }, undefined, false, undefined, this),
            flavorChoosable(adapter.outputExtensions[0] ?? "") && ["normal", "txt", "md"].map((f) => /* @__PURE__ */ jsxDEV("button", {
              type: "button",
              className: `${styles_module_default.flavor}${(flavors[key] ?? "normal") === f ? ` ${styles_module_default.flavorOn}` : ""}`,
              onClick: () => setFlavors((prev) => ({ ...prev, [key]: f })),
              children: f === "normal" ? `.${(adapter.outputExtensions[0] ?? "json").replace(/^\./, "")}` : `.${f}`
            }, f, false, undefined, this))
          ]
        }, undefined, true, undefined, this)
      ]
    }, key, true, undefined, this);
  };
  return /* @__PURE__ */ jsxDEV("div", {
    className: styles_module_default.roomHost,
    children: /* @__PURE__ */ jsxDEV("div", {
      className: styles_module_default.room2,
      children: [
        /* @__PURE__ */ jsxDEV("aside", {
          className: styles_module_default.rail,
          children: [
            /* @__PURE__ */ jsxDEV("span", {
              className: styles_module_default.kick,
              children: "from the library · click to stage"
            }, undefined, false, undefined, this),
            loadNote && /* @__PURE__ */ jsxDEV("p", {
              className: styles_module_default.empty,
              children: loadNote
            }, undefined, false, undefined, this),
            /* @__PURE__ */ jsxDEV("div", {
              className: styles_module_default.offerList,
              children: [
                offers.map((s) => /* @__PURE__ */ jsxDEV("button", {
                  type: "button",
                  className: styles_module_default.offer,
                  onClick: () => ctx.press.stage([s]),
                  children: [
                    /* @__PURE__ */ jsxDEV("span", {
                      className: styles_module_default.offerName,
                      children: s.name || s.id
                    }, undefined, false, undefined, this),
                    /* @__PURE__ */ jsxDEV("span", {
                      className: styles_module_default.jkind,
                      children: s.kind
                    }, undefined, false, undefined, this)
                  ]
                }, pieceKeyOf(s), true, undefined, this)),
                offers.length === 0 && /* @__PURE__ */ jsxDEV("p", {
                  className: styles_module_default.empty,
                  children: "everything is staged"
                }, undefined, false, undefined, this)
              ]
            }, undefined, true, undefined, this)
          ]
        }, undefined, true, undefined, this),
        /* @__PURE__ */ jsxDEV("section", {
          children: [
            /* @__PURE__ */ jsxDEV("div", {
              className: styles_module_default.sheetHead,
              children: [
                /* @__PURE__ */ jsxDEV("span", {
                  className: styles_module_default.kick,
                  children: `the queue · ${queue.length} staged${dropped.size > 0 ? ` · ${dropped.size} dropped` : ""}`
                }, undefined, false, undefined, this),
                /* @__PURE__ */ jsxDEV("span", {
                  className: styles_module_default.targets,
                  children: platforms.map((p) => /* @__PURE__ */ jsxDEV("button", {
                    type: "button",
                    className: `${styles_module_default.tchip}${p.friendly === target ? ` ${styles_module_default.tchipOn}` : ""}`,
                    onClick: () => {
                      setTarget(p.friendly);
                      resetRun();
                    },
                    children: p.friendly
                  }, p.friendly, false, undefined, this))
                }, undefined, false, undefined, this)
              ]
            }, undefined, true, undefined, this),
            queue.length === 0 ? /* @__PURE__ */ jsxDEV("p", {
              className: styles_module_default.empty,
              children: "Nothing staged. Stage pieces from the Library - right-click any piece, or use the rail on the left. A staged character brings his linked lorebooks as a bundle."
            }, undefined, false, undefined, this) : /* @__PURE__ */ jsxDEV(Fragment, {
              children: [
                grouping.bundles.map((bundle) => /* @__PURE__ */ jsxDEV("div", {
                  className: styles_module_default.bundle,
                  children: [
                    /* @__PURE__ */ jsxDEV("div", {
                      className: styles_module_default.bundleMarq,
                      children: [
                        /* @__PURE__ */ jsxDEV("span", {
                          children: `bundle · ${bundle.owner.name}`
                        }, undefined, false, undefined, this),
                        /* @__PURE__ */ jsxDEV("i", {
                          children: bundle.riders.length > 0 ? `character + ${bundle.riders.length} linked` : "character"
                        }, undefined, false, undefined, this),
                        /* @__PURE__ */ jsxDEV("button", {
                          type: "button",
                          className: styles_module_default.unstage,
                          onClick: () => ctx.press.unstage(bundle.owner.id, bundle.owner.kind),
                          children: "unstage ×"
                        }, undefined, false, undefined, this)
                      ]
                    }, undefined, true, undefined, this),
                    card(bundle.owner),
                    bundle.riders.map((r) => card(r, { of: bundle.owner.name }))
                  ]
                }, pieceKeyOf(bundle.owner), true, undefined, this)),
                grouping.solos.map((s) => /* @__PURE__ */ jsxDEV("div", {
                  className: styles_module_default.bundle,
                  children: [
                    /* @__PURE__ */ jsxDEV("div", {
                      className: styles_module_default.bundleMarq,
                      children: [
                        /* @__PURE__ */ jsxDEV("span", {
                          children: `solo · ${s.name}`
                        }, undefined, false, undefined, this),
                        /* @__PURE__ */ jsxDEV("i", {
                          children: s.kind
                        }, undefined, false, undefined, this),
                        /* @__PURE__ */ jsxDEV("button", {
                          type: "button",
                          className: styles_module_default.unstage,
                          onClick: () => ctx.press.unstage(s.id, s.kind),
                          children: "unstage ×"
                        }, undefined, false, undefined, this)
                      ]
                    }, undefined, true, undefined, this),
                    card(s)
                  ]
                }, pieceKeyOf(s), true, undefined, this))
              ]
            }, undefined, true, undefined, this),
            /* @__PURE__ */ jsxDEV("div", {
              className: styles_module_default.foot,
              children: [
                /* @__PURE__ */ jsxDEV("span", {
                  className: styles_module_default.sum,
                  children: rows ? foldSummary(rows) : platform ? foldSummary(planRun(set, platform)) : `${set.length} in the run · pick a platform`
                }, undefined, false, undefined, this),
                zip && /* @__PURE__ */ jsxDEV("button", {
                  type: "button",
                  className: styles_module_default.stamp,
                  onClick: () => triggerDownload(zip.blob, zip.filename),
                  children: "download the bundle"
                }, undefined, false, undefined, this),
                rows && !running && /* @__PURE__ */ jsxDEV("button", {
                  type: "button",
                  className: styles_module_default.stamp,
                  onClick: resetRun,
                  children: "clear the results"
                }, undefined, false, undefined, this),
                queue.length > 0 && !running && /* @__PURE__ */ jsxDEV("button", {
                  type: "button",
                  className: styles_module_default.stamp,
                  onClick: () => {
                    ctx.press.clear();
                    resetRun();
                  },
                  children: "clear the queue"
                }, undefined, false, undefined, this),
                /* @__PURE__ */ jsxDEV("button", {
                  type: "button",
                  className: `${styles_module_default.stamp} ${styles_module_default.stampRun}`,
                  disabled: !platform || set.length === 0 || running,
                  title: !platform ? "Pick a target platform first" : undefined,
                  onClick: () => void run(),
                  children: running ? "printing…" : "run the press"
                }, undefined, false, undefined, this)
              ]
            }, undefined, true, undefined, this)
          ]
        }, undefined, true, undefined, this)
      ]
    }, undefined, true, undefined, this)
  }, undefined, false, undefined, this);
}
var app = {
  manifest: {
    id: "press",
    title: "The Press",
    markSvg: MARK_SVG,
    accent: "#8b5cf6",
    order: 30,
    subtitle: "app · convert",
    agentSurface: PRESS_AGENT_SURFACE
  },
  Component: Press
};
var press_default = app;
export {
  press_default as default
};
