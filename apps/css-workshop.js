{const s=document.createElement("style");s.dataset.vaudeModuleCss="1";s.textContent="/* src/ui/components/expand/styles.module.css */\n.frame_JQblgw {\n  position: relative;\n  display: flex;\n  flex-direction: column;\n  min-width: 0;\n}\n\n.frame_JQblgw > textarea {\n  width: 100%;\n}\n\n.toggle_JQblgw {\n  font-family: var(--font-mono);\n  letter-spacing: .08em;\n  text-transform: uppercase;\n  background: var(--stage-panel);\n  border: 1px solid var(--stage-seam);\n  color: var(--stage-mute);\n  cursor: pointer;\n  padding: .1rem .32rem;\n  font-size: .575rem;\n}\n\n.toggle_JQblgw:hover {\n  color: var(--stage-card);\n  border-color: var(--stage-line);\n}\n\n.toggle_JQblgw:focus-visible {\n  color: var(--stage-card);\n  border-color: var(--stage-line);\n}\n\n.inlineToggle_JQblgw {\n  position: absolute;\n  z-index: 2;\n  opacity: .75;\n  top: .15rem;\n  right: .15rem;\n}\n\n.inlineToggle_JQblgw:hover {\n  opacity: 1;\n}\n\n.inlineToggle_JQblgw:focus-visible {\n  opacity: 1;\n}\n\n.away_JQblgw {\n  border: 1px dashed var(--stage-line);\n  color: var(--stage-mute);\n  font-family: var(--font-mono);\n  letter-spacing: .06em;\n  text-transform: uppercase;\n  display: flex;\n  justify-content: center;\n  align-items:  center;\n  min-height: 2.6rem;\n  font-size: .625rem;\n}\n\n.scrim_JQblgw {\n  position: fixed;\n  z-index: 200;\n  background: var(--scrim);\n  display: flex;\n  padding: var(--gap-s);\n  inset: 0;\n}\n\n.sheet_JQblgw {\n  display: flex;\n  gap: var(--gap-s);\n  background: var(--stage-deck);\n  border: 2px solid var(--stage-seam);\n  padding: var(--gap-s);\n  flex-direction: column;\n  flex: 1;\n  min-width: 0;\n}\n\n.head_JQblgw {\n  display: flex;\n  align-items:  center;\n  gap: var(--gap-s);\n}\n\n.title_JQblgw {\n  font-family: var(--font-big);\n  letter-spacing: .06em;\n  text-transform: uppercase;\n  color: var(--stage-card);\n  overflow-wrap: anywhere;\n  flex: 1;\n  min-width: 0;\n  font-size: .8rem;\n  font-weight: 900;\n}\n\n.hint_JQblgw {\n  font-family: var(--font-mono);\n  letter-spacing: .06em;\n  text-transform: uppercase;\n  color: var(--stage-mute);\n  font-size: .575rem;\n}\n\n.body_JQblgw {\n  display: flex;\n  flex-direction: column;\n  flex: auto;\n  min-height: 0;\n}\n\n.body_JQblgw > * {\n  flex: auto;\n  min-height: 0;\n}\n\n.body_JQblgw textarea {\n  resize: none;\n  width: 100%;\n  height: 100%;\n}\n\n/* src/ui/components/code-editor/index.module.css */\n.wrap_2IOI8g {\n  display: grid;\n  grid-template-columns: auto minmax(0, 1fr);\n  border: 2px solid var(--stage-seam);\n  background: var(--stage-well);\n  font-family: var(--font-mono);\n  overflow: hidden;\n  font-size: .72rem;\n  line-height: 1.6;\n}\n\n.gutter_2IOI8g {\n  text-align: right;\n  color: var(--stage-line);\n  background: var(--stage-ink);\n  border-right: 1px solid var(--stage-seam);\n  user-select: none;\n  overflow: hidden;\n  white-space: pre;\n  padding: .6rem .5rem .6rem .6rem;\n}\n\n.stack_2IOI8g {\n  position: relative;\n  overflow: hidden;\n}\n\n.pre_2IOI8g, .ta_2IOI8g {\n  font: inherit;\n  line-height: inherit;\n  white-space: pre;\n  overflow: auto;\n  tab-size: 2;\n  border: 0;\n  margin: 0;\n  padding: .6rem .7rem;\n}\n\n.pre_2IOI8g {\n  position: absolute;\n  color: var(--stage-soft);\n  pointer-events: none;\n  overflow: hidden;\n  inset: 0;\n}\n\n.ta_2IOI8g {\n  position: relative;\n  display: block;\n  resize: none;\n  color: #0000;\n  caret-color: var(--stage-paper);\n  outline: none;\n  background: none;\n  width: 100%;\n  min-height: 100%;\n}\n\n.ta_2IOI8g::selection {\n  background: var(--stage-seam);\n  color: #0000;\n}\n\n.macro_2IOI8g {\n  color: var(--stage-macro);\n}\n\n.string_2IOI8g {\n  color: var(--stage-ok);\n}\n\n.comment_2IOI8g {\n  color: var(--stage-line);\n  font-style: italic;\n}\n\n.keyword_2IOI8g {\n  color: var(--rose);\n}\n\n.number_2IOI8g {\n  color: var(--stage-var);\n}\n\n.ac_2IOI8g {\n  position: absolute;\n  z-index: 30;\n  background: var(--stage-panel);\n  border: 3px solid var(--stage-black);\n  box-shadow: 4px 4px 0 0 var(--stage-black);\n  width: 22rem;\n  max-width: 90vw;\n}\n\n.acHead_2IOI8g {\n  letter-spacing: .12em;\n  text-transform: uppercase;\n  color: var(--stage-line);\n  border-bottom: 2px solid var(--stage-seam);\n  padding: .35rem .55rem;\n  font-size: .625rem;\n}\n\n.acItem_2IOI8g {\n  display: flex;\n  cursor: pointer;\n  border-left: 3px solid #0000;\n  align-items: baseline;\n  gap: .55rem;\n  padding: .35rem .55rem;\n}\n\n.acItemOn_2IOI8g {\n  background: var(--stage-row);\n  border-left-color: var(--rose);\n}\n\n.acSig_2IOI8g {\n  color: var(--stage-macro);\n  white-space: nowrap;\n}\n\n.acDesc_2IOI8g {\n  color: var(--stage-mute);\n  font-family: var(--font-body);\n  margin-left: auto;\n}\n\n.mirror_2IOI8g {\n  position: absolute;\n  visibility: hidden;\n  white-space: pre-wrap;\n  word-wrap: break-word;\n  pointer-events: none;\n  top: 0;\n  left: 0;\n}\n\n/* src/ui/components/color-picker/styles.module.css */\n.cp_SWqr_A {\n  display: flex;\n  flex-direction: column;\n  gap: .55rem;\n  width: clamp(11rem, 17rem, 100%);\n}\n\n.sv_SWqr_A {\n  position: relative;\n  aspect-ratio: 3 / 2;\n  border: 3px solid var(--ink);\n  box-shadow: 4px 4px 0 0 var(--ink);\n  cursor: crosshair;\n  touch-action: none;\n  width: 100%;\n}\n\n.hue_SWqr_A {\n  position: relative;\n  border: 3px solid var(--ink);\n  box-shadow: 3px 3px 0 0 var(--ink);\n  cursor: ew-resize;\n  touch-action: none;\n  background: linear-gradient(to right, red, #ff0, #0f0, #0ff, #00f, #f0f, red);\n  width: 100%;\n  height: 1rem;\n}\n\n.thumb_SWqr_A {\n  position: absolute;\n  border: 3px solid var(--stage-white);\n  outline: 2px solid var(--stage-black);\n  pointer-events: none;\n  box-shadow: 0 0 0 1px var(--stage-black);\n  border-radius: 50%;\n  width: 14px;\n  height: 14px;\n  transform: translate(-50%, -50%);\n}\n\n.foot_SWqr_A {\n  display: flex;\n  align-items:  center;\n  gap: .5rem;\n}\n\n.chip_SWqr_A {\n  border: 3px solid var(--ink);\n  box-shadow: 2px 2px 0 0 var(--ink);\n  flex: none;\n  width: 1.6rem;\n  height: 1.6rem;\n}\n\n.hex_SWqr_A {\n  font-family: var(--font-mono);\n  letter-spacing: .06em;\n  text-transform: uppercase;\n  color: var(--ink);\n  background: var(--paper);\n  border: 3px solid var(--ink);\n  flex: 1;\n  min-width: 0;\n  padding: .4rem .55rem;\n  font-size: .8rem;\n  font-weight: 700;\n}\n\n.hex_SWqr_A:focus {\n  outline: none;\n  box-shadow: 3px 3px 0 0 var(--ink);\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .sv_SWqr_A, .hue_SWqr_A {\n    transition: none;\n  }\n}\n\n/* src/ui/components/paint-picker/styles.module.css */\n.pp_655Ssw {\n  display: flex;\n  flex-direction: column;\n  gap: .6rem;\n  width: clamp(11rem, 17rem, 100%);\n}\n\n.modes_655Ssw {\n  display: flex;\n  border: 3px solid var(--ink);\n  box-shadow: 3px 3px 0 0 var(--ink);\n}\n\n.modes_655Ssw button {\n  border: none;\n  border-left: 3px solid var(--ink);\n  background: var(--paper);\n  font-family: var(--font-mono), monospace;\n  letter-spacing: .08em;\n  text-transform: uppercase;\n  color: var(--ink);\n  cursor: pointer;\n  flex: 1;\n  padding: .42rem;\n  font-size: .625rem;\n  font-weight: 700;\n}\n\n.modes_655Ssw button:first-child {\n  border-left: none;\n}\n\n.modes_655Ssw button.on_655Ssw {\n  background: var(--ink);\n  color: var(--paper);\n}\n\n.grad_655Ssw {\n  display: flex;\n  flex-direction: column;\n  gap: .55rem;\n}\n\n.bar_655Ssw {\n  position: relative;\n  border: 3px solid var(--ink);\n  box-shadow: 3px 3px 0 0 var(--ink);\n  cursor: copy;\n  touch-action: none;\n  width: 100%;\n  height: 1.5rem;\n  margin-top: .5rem;\n}\n\n.stop_655Ssw {\n  position: absolute;\n  border: 3px solid var(--ink);\n  cursor: grab;\n  touch-action: none;\n  box-shadow: 0 0 0 2px var(--paper);\n  width: 14px;\n  height: 2rem;\n  top: 50%;\n  transform: translate(-50%, -50%);\n}\n\n.stop_655Ssw.sel_655Ssw {\n  box-shadow: 0 0 0 2px var(--paper), 0 0 0 5px var(--ink);\n  z-index: 2;\n}\n\n.row_655Ssw {\n  display: flex;\n  align-items:  center;\n  gap: .5rem;\n}\n\n.out_655Ssw {\n  border: 3px solid var(--ink);\n  box-shadow: 2px 2px 0 0 var(--ink);\n  flex: none;\n  width: 1.7rem;\n  height: 1.7rem;\n}\n\n.seg_655Ssw {\n  display: flex;\n  border: 3px solid var(--ink);\n}\n\n.seg_655Ssw button {\n  border: none;\n  border-left: 3px solid var(--ink);\n  background: var(--paper);\n  font-family: var(--font-mono), monospace;\n  letter-spacing: .06em;\n  text-transform: uppercase;\n  color: var(--ink);\n  cursor: pointer;\n  padding: .32rem .55rem;\n  font-size: .625rem;\n  font-weight: 700;\n}\n\n.seg_655Ssw button:first-child {\n  border-left: none;\n}\n\n.seg_655Ssw button.on_655Ssw {\n  background: var(--ink);\n  color: var(--paper);\n}\n\n.rm_655Ssw {\n  font-family: var(--font-mono), monospace;\n  letter-spacing: .06em;\n  text-transform: uppercase;\n  background: var(--paper);\n  border: 3px solid var(--ink);\n  color: var(--ink);\n  cursor: pointer;\n  margin-left: auto;\n  padding: .32rem .55rem;\n  font-size: .625rem;\n  font-weight: 700;\n}\n\n.rm_655Ssw:disabled {\n  opacity: .4;\n  cursor: not-allowed;\n}\n\n.angle_655Ssw {\n  display: flex;\n  align-items:  center;\n  gap: .5rem;\n}\n\n.angle_655Ssw input {\n  flex: 1;\n  min-width: 0;\n}\n\n.deg_655Ssw {\n  font-family: var(--font-mono), monospace;\n  color: var(--ink);\n  text-align: right;\n  min-width: 2.6rem;\n  font-size: .625rem;\n  font-weight: 700;\n}\n\n/* src/ui/components/slider/styles.module.css */\n.wrap_iiNPuw {\n  display: flex;\n  align-items:  center;\n  gap: .7rem;\n}\n\n.range_iiNPuw {\n  -webkit-appearance: none;\n  appearance: none;\n  background: var(--seam);\n  cursor: ew-resize;\n  flex: 1;\n  height: 3px;\n}\n\n.range_iiNPuw::-webkit-slider-thumb {\n  -webkit-appearance: none;\n  appearance: none;\n  background: var(--ink);\n  border: 2px solid var(--ink);\n  cursor: ew-resize;\n  border-radius: 0;\n  width: 12px;\n  height: 12px;\n}\n\n.range_iiNPuw::-moz-range-thumb {\n  background: var(--ink);\n  cursor: ew-resize;\n  border: none;\n  border-radius: 0;\n  width: 12px;\n  height: 12px;\n}\n\n.readout_iiNPuw {\n  font-family: var(--font-mono);\n  color: var(--text-soft, var(--muted));\n  text-align: right;\n  min-width: 2.6rem;\n  font-size: .75rem;\n}\n\n/* src/ui/components/toggle-switch/styles.module.css */\n.btn_-Rb0iw {\n  display: inline-flex;\n  cursor: pointer;\n  font-family: var(--font-mono);\n  letter-spacing: .04em;\n  text-transform: uppercase;\n  color: var(--text-soft, var(--muted));\n  background: none;\n  border: none;\n  align-items:  center;\n  gap: .45rem;\n  padding: 0;\n  font-size: .7rem;\n}\n\n.track_-Rb0iw {\n  position: relative;\n  background: var(--seam);\n  border: 2px solid var(--edge);\n  flex: none;\n  width: 2.1rem;\n  height: 1.1rem;\n}\n\n.on_-Rb0iw .track_-Rb0iw {\n  background: var(--toggle-on, var(--rose));\n}\n\n.knob_-Rb0iw {\n  position: absolute;\n  background: var(--panel);\n  border-right: 2px solid var(--edge);\n  width: .9rem;\n  height: .9rem;\n  top: 0;\n  left: 0;\n}\n\n.on_-Rb0iw .knob_-Rb0iw {\n  border-right: none;\n  border-left: 2px solid var(--edge);\n  left: auto;\n  right: 0;\n}\n\n/* src/ui/components/css-workshop/styles.module.css */\n.root_3vyzkQ {\n  display: flex;\n  flex-direction: column;\n  gap: .55rem;\n  min-width: 0;\n}\n\n.banner_3vyzkQ {\n  font-family: var(--font-body);\n  color: var(--stage-mute, var(--muted));\n  border: 2px dashed var(--stage-seam, var(--seam));\n  background: var(--stage-well, var(--paper));\n  padding: .4rem .55rem;\n  font-size: .78rem;\n  line-height: 1.35;\n}\n\n.banner_3vyzkQ strong {\n  color: var(--stage-soft, var(--text-soft));\n  font-weight: 700;\n}\n\n.modeToggle_3vyzkQ {\n  display: inline-flex;\n  border: 2px solid var(--stage-black, var(--edge));\n  background: var(--stage-well, var(--paper));\n}\n\n.modeBtn_3vyzkQ {\n  font-family: var(--font-mono);\n  letter-spacing: .08em;\n  text-transform: uppercase;\n  border: none;\n  border-right: 2px solid var(--stage-black, var(--edge));\n  color: var(--stage-mute, var(--muted));\n  cursor: pointer;\n  background: none;\n  padding: .35rem .6rem;\n  font-size: .625rem;\n  font-weight: 700;\n}\n\n.modeBtn_3vyzkQ:last-child {\n  border-right: none;\n}\n\n.modeOn_3vyzkQ {\n  background: var(--stage-panel, var(--panel));\n  color: var(--stage-soft, var(--text-soft));\n}\n\n.tabs_3vyzkQ {\n  display: flex;\n  flex-wrap: wrap;\n  gap: .3rem;\n}\n\n.tab_3vyzkQ {\n  font-family: var(--font-mono);\n  letter-spacing: .08em;\n  text-transform: uppercase;\n  border: 2px solid var(--stage-seam, var(--seam));\n  background: var(--stage-well, var(--paper));\n  color: var(--stage-mute, var(--muted));\n  cursor: pointer;\n  padding: .35rem .55rem;\n  font-size: .625rem;\n  font-weight: 700;\n}\n\n.tabOn_3vyzkQ {\n  border-color: var(--stage-black, var(--edge));\n  background: var(--stage-panel, var(--panel));\n  color: var(--stage-soft, var(--text-soft));\n}\n\n.packRow_3vyzkQ {\n  display: flex;\n  flex-wrap: wrap;\n  align-items:  center;\n  gap: .35rem;\n}\n\n.packLabel_3vyzkQ {\n  font-family: var(--font-mono);\n  letter-spacing: .1em;\n  text-transform: uppercase;\n  color: var(--stage-mute, var(--muted));\n  font-size: .625rem;\n}\n\n.sel_3vyzkQ {\n  font-family: var(--font-mono);\n  background: var(--stage-well, var(--field, var(--paper)));\n  border: 2px solid var(--stage-seam, var(--seam));\n  color: var(--stage-soft, var(--text-soft));\n  max-width: 100%;\n  padding: .3rem .4rem;\n  font-size: .75rem;\n}\n\n.recipe_3vyzkQ {\n  border: 2px solid var(--stage-seam, var(--seam));\n  background: var(--stage-panel, var(--panel));\n  display: flex;\n  flex-direction: column;\n  gap: .3rem;\n  padding: .45rem .55rem;\n}\n\n.recipeHead_3vyzkQ {\n  display: flex;\n  align-items:  center;\n  gap: .4rem;\n}\n\n.recipeTitle_3vyzkQ {\n  font-family: var(--font-body);\n  color: var(--stage-soft, var(--text));\n  font-size: .88rem;\n  font-weight: 700;\n}\n\n.useBtn_3vyzkQ {\n  font-family: var(--font-mono);\n  letter-spacing: .06em;\n  text-transform: uppercase;\n  border: 2px solid var(--stage-black, var(--edge));\n  background: var(--stage-well, var(--paper));\n  color: var(--stage-soft, var(--text-soft));\n  cursor: pointer;\n  margin-left: auto;\n  padding: .28rem .45rem;\n  font-size: .625rem;\n  font-weight: 700;\n}\n\n.blurb_3vyzkQ {\n  font-family: var(--font-body);\n  color: var(--stage-mute, var(--muted));\n  margin: 0;\n  font-size: .78rem;\n}\n\n.previewBlock_3vyzkQ {\n  border: 2px solid var(--stage-seam, var(--seam));\n  background: var(--stage-well, var(--paper));\n}\n\n.frame_3vyzkQ {\n  display: block;\n  box-sizing: border-box;\n  background: #0c0b10;\n  border: 0;\n  width: 100%;\n  min-height: 10rem;\n  max-height: 16rem;\n}\n\n.assist_3vyzkQ {\n  display: flex;\n  flex-direction: column;\n  gap: .5rem;\n}\n\n.ruleList_3vyzkQ {\n  display: flex;\n  overflow: auto;\n  flex-direction: column;\n  gap: .25rem;\n  max-height: 8rem;\n}\n\n.ruleBtn_3vyzkQ {\n  text-align: left;\n  font-family: var(--font-mono);\n  border: 2px solid var(--stage-seam, var(--seam));\n  background: var(--stage-well, var(--paper));\n  color: var(--stage-mute, var(--muted));\n  cursor: pointer;\n  word-break: break-word;\n  padding: .3rem .4rem;\n  font-size: .7rem;\n}\n\n.ruleBtnOn_3vyzkQ {\n  border-color: var(--stage-black, var(--edge));\n  color: var(--stage-soft, var(--text-soft));\n  background: var(--stage-panel, var(--panel));\n}\n\n.knobGrid_3vyzkQ {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr);\n  gap: .45rem;\n}\n\n.knob_3vyzkQ {\n  display: flex;\n  flex-direction: column;\n  gap: .2rem;\n}\n\n.knobLabel_3vyzkQ {\n  font-family: var(--font-mono);\n  letter-spacing: .1em;\n  text-transform: uppercase;\n  color: var(--stage-mute, var(--muted));\n  font-size: .625rem;\n}\n\n.row_3vyzkQ {\n  display: flex;\n  flex-wrap: wrap;\n  align-items:  center;\n  gap: .35rem;\n}\n\n.input_3vyzkQ {\n  font-family: var(--font-mono);\n  background: var(--stage-well, var(--field, var(--paper)));\n  border: 2px solid var(--stage-seam, var(--seam));\n  color: var(--stage-soft, var(--text-soft));\n  flex: 1;\n  min-width: 6rem;\n  padding: .3rem .4rem;\n  font-size: .78rem;\n}\n\n.check_3vyzkQ {\n  display: flex;\n  font-family: var(--font-mono);\n  color: var(--stage-mute, var(--muted));\n  align-items:  center;\n  gap: .3rem;\n  font-size: .68rem;\n}\n\n.hint_3vyzkQ {\n  font-family: var(--font-body);\n  color: var(--stage-mute, var(--muted));\n  margin: 0;\n  font-size: .75rem;\n}\n\n.english_3vyzkQ {\n  font-family: var(--font-mono);\n  color: var(--stage-soft, var(--text-soft));\n  background: var(--stage-well, var(--paper));\n  border: 2px solid var(--stage-seam, var(--seam));\n  word-break: break-word;\n  padding: .35rem .45rem;\n  font-size: .68rem;\n}\n\n.actions_3vyzkQ {\n  display: flex;\n  flex-wrap: wrap;\n  gap: .3rem;\n}\n\n.mini_3vyzkQ {\n  font-family: var(--font-mono);\n  letter-spacing: .06em;\n  text-transform: uppercase;\n  border: 2px solid var(--stage-seam, var(--seam));\n  background: var(--stage-well, var(--paper));\n  color: var(--stage-soft, var(--text-soft));\n  cursor: pointer;\n  padding: .28rem .4rem;\n  font-size: .625rem;\n  font-weight: 700;\n}\n\n.sourceHead_3vyzkQ {\n  display: flex;\n  justify-content: space-between;\n  align-items: baseline;\n  gap: .4rem;\n}\n\n.sourceLabel_3vyzkQ {\n  font-family: var(--font-mono);\n  letter-spacing: .1em;\n  text-transform: uppercase;\n  color: var(--stage-mute, var(--muted));\n  font-size: .625rem;\n}\n\n.chips_3vyzkQ {\n  display: flex;\n  flex-wrap: wrap;\n  gap: .25rem;\n}\n\n.chip_3vyzkQ {\n  font-family: var(--font-mono);\n  border: 2px solid var(--stage-seam, var(--seam));\n  background: var(--stage-well, var(--paper));\n  color: var(--stage-mute, var(--muted));\n  cursor: pointer;\n  padding: .22rem .4rem;\n  font-size: .625rem;\n}\n\n.chip_3vyzkQ:hover {\n  color: var(--stage-soft, var(--text-soft));\n  border-color: var(--stage-black, var(--edge));\n}\n\n.advanced_3vyzkQ {\n  display: flex;\n  flex-direction: column;\n  gap: .5rem;\n}\n\n.advGrid_3vyzkQ {\n  display: grid;\n  grid-template-columns: minmax(0, 1.15fr) minmax(12rem, .95fr);\n  align-items:  start;\n  gap: .65rem;\n}\n\n@media (max-width: 48rem) {\n  .advGrid_3vyzkQ {\n    grid-template-columns: 1fr;\n  }\n}\n\n.advCode_3vyzkQ {\n  display: flex;\n  flex-direction: column;\n  gap: .35rem;\n  min-width: 0;\n}\n\n.advBreak_3vyzkQ {\n  display: flex;\n  overflow: auto;\n  border: 2px solid var(--stage-seam, var(--seam));\n  background: var(--stage-well, var(--paper));\n  flex-direction: column;\n  gap: .35rem;\n  min-width: 0;\n  max-height: 28rem;\n  padding: .45rem .5rem;\n}\n\n.advKnobs_3vyzkQ {\n  display: flex;\n  border-top: 2px solid var(--stage-seam, var(--seam));\n  flex-direction: column;\n  gap: .35rem;\n  margin-top: .2rem;\n  padding-top: .45rem;\n}\n\n.freeformBlock_3vyzkQ {\n  font-family: var(--font-mono);\n  color: var(--stage-mute, var(--muted));\n  white-space: pre-wrap;\n  word-break: break-word;\n  overflow: auto;\n  border: 2px dashed var(--stage-seam, var(--seam));\n  max-height: 6rem;\n  margin: 0;\n  padding: .35rem .4rem;\n  font-size: .65rem;\n}\n\n.fileInput_3vyzkQ {\n  position: absolute;\n  opacity: 0;\n  overflow: hidden;\n  clip: rect(0, 0, 0, 0);\n  width: 1px;\n  height: 1px;\n}\n\n.importFlash_3vyzkQ {\n  font-family: var(--font-mono);\n  color: var(--stage-mute, var(--muted));\n  font-size: .65rem;\n}\n\n/* src/ui/components/ink-dialog/styles.module.css */\n.overlay_wz5sqg {\n  position: fixed;\n  z-index: 150;\n  background: var(--shadow-ink);\n  display: flex;\n  justify-content: center;\n  align-items:  center;\n  padding: 1rem;\n  inset: 0;\n}\n\n.sheet_wz5sqg {\n  background: var(--face);\n  color: var(--text);\n  border: 3px solid var(--edge);\n  box-shadow: 6px 6px 0 0 var(--edge);\n  width: 100%;\n  max-width: 24rem;\n  padding: 1.1rem 1.3rem;\n}\n\n/* src/ui/components/mono-tag/styles.module.css */\n.tag_C_dYbA {\n  font-family: var(--font-mono);\n  letter-spacing: .2em;\n  text-transform: uppercase;\n  color: var(--text-dim);\n  font-size: .625rem;\n  font-weight: 700;\n}\n\n.tagDim_C_dYbA {\n  color: var(--text-faint);\n}\n\n/* src/ui/components/tour-guide/styles.module.css */\n.rail_13SYuA {\n  position: fixed;\n  overflow-y: auto;\n  z-index: 60;\n  display: flex;\n  background: var(--panel);\n  border: 3px solid var(--rose);\n  box-shadow: 6px 6px 0 0 var(--edge);\n  font-family: var(--font-body);\n  flex-direction: column;\n  gap: .5rem;\n  width: 19rem;\n  max-width: calc(100vw - 2rem);\n  max-height: calc(100vh - 2rem);\n  padding: 1rem 1.1rem;\n  top: 50%;\n  right: 1.1rem;\n  transform: translateY(-50%);\n}\n\n.kick_13SYuA {\n  display: flex;\n  align-items:  center;\n  gap: .6rem;\n}\n\n.skip_13SYuA {\n  font-family: var(--font-mono);\n  letter-spacing: .06em;\n  text-transform: uppercase;\n  color: var(--muted);\n  text-decoration: underline;\n  cursor: pointer;\n  background: none;\n  border: none;\n  margin-left: auto;\n  padding: 0;\n  font-size: .625rem;\n}\n\n.skip_13SYuA:hover {\n  color: var(--text);\n}\n\n.dots_13SYuA {\n  display: flex;\n  gap: 5px;\n  margin-top: .3rem;\n}\n\n.dots_13SYuA i {\n  border: 2px solid var(--edge);\n  background: var(--panel);\n  display: block;\n  flex: none;\n  width: 9px;\n  height: 9px;\n}\n\n.dots_13SYuA i.done_13SYuA {\n  background: var(--edge);\n}\n\n.dots_13SYuA i.now_13SYuA {\n  background: var(--rose);\n  border-color: var(--rose);\n}\n\n.count_13SYuA {\n  font-family: var(--font-mono);\n  letter-spacing: .14em;\n  text-transform: uppercase;\n  color: var(--muted);\n  font-size: .625rem;\n}\n\n.title_13SYuA {\n  font-family: var(--font-big);\n  letter-spacing: -.01em;\n  color: var(--text);\n  margin: .1rem 0 .2rem;\n  font-size: 1.3rem;\n  font-weight: 900;\n  line-height: 1.05;\n}\n\n.noAnchor_13SYuA {\n  font-family: var(--font-mono);\n  letter-spacing: .04em;\n  color: var(--text-dim);\n  border-left: 2px solid var(--stage-warn);\n  margin: .4rem 0 0;\n  padding-left: .5rem;\n  font-size: .625rem;\n}\n\n.body_13SYuA {\n  color: var(--text-soft, var(--stage-soft));\n  margin: 0;\n  font-size: 1rem;\n  line-height: 1.5;\n}\n\n.choice_13SYuA {\n  display: flex;\n  flex-direction: column;\n  gap: .4rem;\n  margin-top: .3rem;\n}\n\n.pick_13SYuA {\n  text-align: left;\n  font: inherit;\n  cursor: pointer;\n  background: var(--face, var(--panel));\n  border: 3px solid var(--edge);\n  box-shadow: 3px 3px 0 0 var(--edge);\n  padding: .45rem .6rem;\n  transition: transform .1s ease-out, box-shadow .1s ease-out, border-color .1s ease-out;\n}\n\n.pick_13SYuA:hover {\n  box-shadow: 5px 5px 0 0 var(--edge);\n  transform: translate(-2px, -2px);\n}\n\n.pickOn_13SYuA {\n  box-shadow: 1px 1px 0 0 var(--rose);\n  border-color: var(--rose);\n  transform: translate(3px, 3px);\n}\n\n.pick_13SYuA b {\n  font-family: var(--font-big);\n  color: var(--text);\n  display: block;\n  font-size: .95rem;\n  font-weight: 700;\n}\n\n.pick_13SYuA span {\n  font-family: var(--font-mono);\n  letter-spacing: .04em;\n  color: var(--muted);\n  font-size: .625rem;\n}\n\n.ctl_13SYuA {\n  display: flex;\n  border-top: 2px solid var(--line, var(--seam));\n  justify-content: space-between;\n  align-items:  center;\n  gap: .6rem;\n  margin-top: .3rem;\n  padding-top: .7rem;\n}\n\n.back_13SYuA {\n  font-family: var(--font-mono);\n  letter-spacing: .06em;\n  text-transform: uppercase;\n  color: var(--muted);\n  cursor: pointer;\n  background: none;\n  border: none;\n  padding: 0;\n  font-size: .66rem;\n}\n\n.back_13SYuA:disabled {\n  opacity: .4;\n  cursor: default;\n}\n\n.next_13SYuA {\n  font-family: var(--font-big);\n  letter-spacing: .02em;\n  color: var(--stage-white);\n  background: var(--rose-deep);\n  border: 3px solid var(--edge);\n  box-shadow: 4px 4px 0 0 var(--edge);\n  cursor: pointer;\n  padding: .45rem .95rem;\n  transition: transform .1s ease-out, box-shadow .1s ease-out;\n  font-size: .9rem;\n  font-weight: 700;\n}\n\n.next_13SYuA:hover {\n  box-shadow: 6px 6px 0 0 var(--edge);\n  transform: translate(-2px, -2px);\n}\n\n.next_13SYuA:active {\n  box-shadow: 1px 1px 0 0 var(--edge);\n  transform: translate(3px, 3px);\n}\n\n.tourHl {\n  outline: 3px solid var(--rose);\n  outline-offset: 3px;\n  border-radius: 2px;\n  scroll-margin: 6rem;\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .pick_13SYuA, .next_13SYuA {\n    transition: none;\n  }\n}\n\n/* src/ui/apps/css-workshop/styles.module.css */\n.room_cQgX6g {\n  display: flex;\n  box-sizing: border-box;\n  flex-direction: column;\n  gap: .75rem;\n  min-height: 100%;\n  padding: clamp(.7rem, 1.8vw, 1.2rem);\n}\n\n.head_cQgX6g {\n  display: flex;\n  flex-wrap: wrap;\n  justify-content: space-between;\n  align-items:  flex-start;\n  gap: .75rem;\n}\n\n.titles_cQgX6g {\n  display: flex;\n  flex-direction: column;\n  gap: .2rem;\n  min-width: 0;\n}\n\n.eyebrow_cQgX6g {\n  font-family: var(--font-mono);\n  letter-spacing: .12em;\n  text-transform: uppercase;\n  color: var(--stage-mute, var(--muted));\n  font-size: .625rem;\n}\n\n.title_cQgX6g {\n  font-family: var(--font-big, sans-serif);\n  letter-spacing: -.02em;\n  color: var(--stage-soft, var(--text));\n  margin: 0;\n  font-size: clamp(1.2rem, 1rem + 1.2vw, 1.65rem);\n  font-weight: 900;\n}\n\n.lede_cQgX6g {\n  font-family: var(--font-body);\n  color: var(--stage-mute, var(--muted));\n  max-width: 40rem;\n  margin: 0;\n  font-size: .95rem;\n  font-style: italic;\n  font-weight: 600;\n}\n\n.actions_cQgX6g {\n  display: flex;\n  flex-wrap: wrap;\n  align-items:  center;\n  gap: .35rem;\n}\n\n.modeToggle_cQgX6g {\n  display: inline-flex;\n  border: 2px solid var(--stage-black, var(--edge));\n  background: var(--stage-well, var(--paper));\n}\n\n.modeBtn_cQgX6g {\n  font-family: var(--font-mono);\n  letter-spacing: .08em;\n  text-transform: uppercase;\n  border: none;\n  border-right: 2px solid var(--stage-black, var(--edge));\n  color: var(--stage-mute, var(--muted));\n  cursor: pointer;\n  background: none;\n  padding: .4rem .65rem;\n  font-size: .625rem;\n  font-weight: 700;\n}\n\n.modeBtn_cQgX6g:last-child {\n  border-right: none;\n}\n\n.modeOn_cQgX6g {\n  background: var(--accent-deep, var(--rose-deep));\n  color: var(--stage-white);\n}\n\n.btn_cQgX6g {\n  font-family: var(--font-mono);\n  letter-spacing: .08em;\n  text-transform: uppercase;\n  border: 2px solid var(--stage-black, var(--edge));\n  background: var(--stage-panel, var(--panel));\n  color: var(--stage-soft, var(--text-soft));\n  cursor: pointer;\n  padding: .4rem .6rem;\n  font-size: .625rem;\n  font-weight: 700;\n}\n\n.btnPrimary_cQgX6g {\n  background: var(--accent, var(--rose));\n  color: var(--stage-white);\n  border-color: var(--stage-black, var(--edge));\n}\n\n.btnGhost_cQgX6g {\n  color: var(--stage-mute, var(--muted));\n  background: none;\n  border-style: dashed;\n}\n\n.stage_cQgX6g {\n  background: var(--stage-panel, var(--panel));\n  border: 3px solid var(--stage-black, var(--edge));\n  box-shadow: 4px 4px 0 0 var(--stage-black, var(--edge));\n  overflow: auto;\n  flex: 1;\n  min-height: 0;\n  padding: .7rem .85rem;\n}\n\n.flash_cQgX6g {\n  font-family: var(--font-mono);\n  color: var(--stage-mute, var(--muted));\n  font-size: .68rem;\n}\n\n.fileInput_cQgX6g {\n  position: absolute;\n  opacity: 0;\n  overflow: hidden;\n  clip: rect(0, 0, 0, 0);\n  width: 1px;\n  height: 1px;\n}\n\n.clearSheet_cQgX6g {\n  background: var(--stage-panel, var(--panel));\n  color: var(--stage-soft, var(--text));\n  width: min(22rem, 88vw);\n  padding: .9rem 1rem 1.1rem;\n}\n\n.clearTitle_cQgX6g {\n  display: block;\n  font-family: var(--font-big, sans-serif);\n  color: var(--stage-soft, var(--text));\n  margin: 0 0 .4rem;\n  font-size: .85rem;\n  font-weight: 900;\n}\n\n.clearBody_cQgX6g {\n  font-family: var(--font-body);\n  color: var(--stage-mute, var(--muted));\n  margin: 0 0 .8rem;\n  font-size: .8rem;\n  line-height: 1.5;\n}\n\n.clearActs_cQgX6g {\n  display: flex;\n  gap: .5rem;\n}\n\n.clearGo_cQgX6g {\n  font-family: var(--font-mono);\n  letter-spacing: .08em;\n  text-transform: uppercase;\n  background: var(--rose-deep);\n  color: var(--stage-white);\n  border: 3px solid var(--stage-black, var(--edge));\n  box-shadow: 3px 3px 0 0 var(--stage-black, var(--edge));\n  cursor: pointer;\n  padding: .45rem .9rem;\n  font-size: .625rem;\n  font-weight: 700;\n}\n\n.clearKeep_cQgX6g {\n  font-family: var(--font-mono);\n  letter-spacing: .08em;\n  text-transform: uppercase;\n  color: var(--stage-mute, var(--muted));\n  border: 2px solid var(--stage-black, var(--edge));\n  cursor: pointer;\n  background: none;\n  padding: .45rem .8rem;\n  font-size: .625rem;\n  font-weight: 700;\n}\n";document.head.append(s);}
// src/ui/apps/css-workshop/room.tsx
import { useCallback as useCallback3, useEffect as useEffect6, useRef as useRef6, useState as useState7 } from "react";

// src/ui/components/css-workshop/index.tsx
import { useEffect as useEffect3, useMemo, useRef as useRef4, useState as useState5 } from "react";

// src/ui/components/css-workshop/model.ts
var idSeq = 0;
var nextId = () => {
  idSeq += 1;
  return `r${idSeq}`;
};
var emptyDoc = () => ({ rules: [], freeform: "" });
var makeRule = (selector, decls = [], comment) => ({
  id: nextId(),
  selector: selector.trim() || ".card",
  decls: decls.map((d) => ({ ...d, property: d.property.trim(), value: d.value.trim() })),
  comment
});
var fmtDecl = (d) => {
  const imp = d.important ? " !important" : "";
  return `  ${d.property}: ${d.value}${imp};`;
};
function emitCss(doc) {
  const chunks = [];
  for (const rule of doc.rules) {
    if (rule.comment)
      chunks.push(`/* ${rule.comment} */`);
    const body = rule.decls.map(fmtDecl).join(`
`);
    chunks.push(`${rule.selector} {
${body}
}`);
  }
  const free = doc.freeform.trim();
  if (free) {
    if (chunks.length > 0)
      chunks.push("");
    chunks.push(free);
  }
  return chunks.join(`

`);
}
var parseDeclLine = (line) => {
  const t = line.trim();
  if (!t || t.startsWith("/*") || t.startsWith("//"))
    return null;
  const m = t.match(/^([a-zA-Z-]+)\s*:\s*(.+?)\s*;?\s*$/);
  if (!m)
    return null;
  let value = m[2].trim();
  let important = false;
  if (/\s*!important\s*$/i.test(value)) {
    important = true;
    value = value.replace(/\s*!important\s*$/i, "").trim();
  }
  if (!value)
    return null;
  return { property: m[1].toLowerCase(), value, important };
};
function parseCss(raw) {
  if (!raw || !raw.trim())
    return emptyDoc();
  const rules = [];
  const freeParts = [];
  let i = 0;
  const s = raw;
  let pendingComment;
  while (i < s.length) {
    if (/\s/.test(s[i])) {
      i += 1;
      continue;
    }
    if (s.startsWith("/*", i)) {
      const end = s.indexOf("*/", i + 2);
      if (end === -1) {
        freeParts.push(s.slice(i));
        break;
      }
      const body = s.slice(i + 2, end).trim();
      pendingComment = body || undefined;
      i = end + 2;
      continue;
    }
    if (s[i] === "@") {
      const start = i;
      while (i < s.length && s[i] !== "{" && s[i] !== ";")
        i += 1;
      if (s[i] === ";") {
        i += 1;
        freeParts.push(s.slice(start, i).trim());
        pendingComment = undefined;
        continue;
      }
      if (s[i] !== "{") {
        freeParts.push(s.slice(start).trim());
        break;
      }
      let depth2 = 0;
      for (;i < s.length; i++) {
        if (s[i] === "{")
          depth2 += 1;
        else if (s[i] === "}") {
          depth2 -= 1;
          if (depth2 === 0) {
            i += 1;
            break;
          }
        }
      }
      freeParts.push(s.slice(start, i).trim());
      pendingComment = undefined;
      continue;
    }
    const brace = s.indexOf("{", i);
    if (brace === -1) {
      freeParts.push(s.slice(i).trim());
      break;
    }
    const selector = s.slice(i, brace).trim();
    if (!selector || selector.includes("{") || selector.includes("}")) {
      freeParts.push(s.slice(i).trim());
      break;
    }
    let depth = 0;
    let j = brace;
    for (;j < s.length; j++) {
      if (s[j] === "{")
        depth += 1;
      else if (s[j] === "}") {
        depth -= 1;
        if (depth === 0) {
          j += 1;
          break;
        }
      }
    }
    const block = s.slice(brace + 1, j - 1);
    if (block.includes("{")) {
      freeParts.push(s.slice(i, j).trim());
      pendingComment = undefined;
      i = j;
      continue;
    }
    const decls = [];
    for (const part of block.split(";")) {
      const d = parseDeclLine(`${part.trim()};`);
      if (d)
        decls.push(d);
    }
    rules.push(makeRule(selector, decls, pendingComment));
    pendingComment = undefined;
    i = j;
  }
  return {
    rules,
    freeform: freeParts.filter(Boolean).join(`

`)
  };
}
function getProp(rule, property) {
  const key = property.toLowerCase();
  return rule.decls.find((d) => d.property === key);
}
function setProp(rule, property, value, important = false) {
  const key = property.toLowerCase().trim();
  const rest = rule.decls.filter((d) => d.property !== key);
  const v = value.trim();
  if (!v)
    return { ...rule, decls: rest };
  return {
    ...rule,
    decls: [...rest, { property: key, value: v, important: important || undefined }]
  };
}
function replaceRule(doc, rule) {
  return {
    ...doc,
    rules: doc.rules.map((r) => r.id === rule.id ? rule : r)
  };
}
function appendRule(doc, rule) {
  return { ...doc, rules: [...doc.rules, rule] };
}
function removeRule(doc, id) {
  return { ...doc, rules: doc.rules.filter((r) => r.id !== id) };
}
function mergeCss(base, addition) {
  const a = addition.trim();
  if (!a)
    return base;
  const b = base.trim();
  if (!b)
    return a;
  return `${b}

/* --- starter --- */

${a}`;
}
function summarizeRule(rule) {
  if (rule.decls.length === 0)
    return `${rule.selector} { (empty) }`;
  const bits = rule.decls.slice(0, 4).map((d) => {
    const v = d.value.length > 28 ? `${d.value.slice(0, 28)}...` : d.value;
    return `${d.property}: ${v}`;
  });
  const more = rule.decls.length > 4 ? ` +${rule.decls.length - 4} more` : "";
  return `${rule.selector} { ${bits.join("; ")}${more} }`;
}

// src/ui/components/code-editor/index.tsx
import { useCallback as useCallback2, useRef as useRef2, useState as useState2 } from "react";

// src/ui/components/expand/index.tsx
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

// src/ui/components/expand/expand-core.ts
function readCaret(el) {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? start;
  return { start, end, scrollTop: el.scrollTop };
}
function clampCaret(caret, length) {
  const start = Math.max(0, Math.min(caret.start, length));
  const end = Math.max(start, Math.min(caret.end, length));
  return { start, end, scrollTop: Math.max(0, caret.scrollTop) };
}
function applyCaret(el, caret) {
  const safe = clampCaret(caret, el.value.length);
  el.setSelectionRange(safe.start, safe.end);
  el.scrollTop = safe.scrollTop;
}
function isEscapeClose(e) {
  if (e.key !== "Escape")
    return false;
  if (e.defaultPrevented)
    return false;
  return e.isComposing !== true;
}
function trapTarget(focusables, active, backwards) {
  if (focusables.length === 0)
    return null;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const at = active === null ? -1 : focusables.indexOf(active);
  if (at === -1)
    return first;
  if (backwards)
    return at === 0 ? last : null;
  return at === focusables.length - 1 ? first : null;
}

// src/ui/components/expand/styles.module.css
var styles_module_default = {
  frame: "frame_JQblgw",
  toggle: "toggle_JQblgw",
  inlineToggle: "inlineToggle_JQblgw",
  away: "away_JQblgw",
  scrim: "scrim_JQblgw",
  sheet: "sheet_JQblgw",
  head: "head_JQblgw",
  title: "title_JQblgw",
  hint: "hint_JQblgw",
  body: "body_JQblgw"
};

// src/ui/components/expand/index.tsx
import { jsxDEV } from "react/jsx-dev-runtime";
var FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(",");
var editorIn = (root) => root?.querySelector("textarea") ?? null;
function ExpandBox({ label, children, onExpandedChange }) {
  const [expanded, setExpanded] = useState(false);
  const inlineRef = useRef(null);
  const sheetRef = useRef(null);
  const triggerRef = useRef(null);
  const caretRef = useRef(null);
  const everOpened = useRef(false);
  const titleId = useId();
  const open = useCallback(() => {
    const ta = editorIn(inlineRef.current);
    caretRef.current = ta ? readCaret(ta) : null;
    setExpanded(true);
    onExpandedChange?.(true);
  }, [onExpandedChange]);
  const close = useCallback(() => {
    const ta = editorIn(sheetRef.current);
    caretRef.current = ta ? readCaret(ta) : null;
    setExpanded(false);
    onExpandedChange?.(false);
  }, [onExpandedChange]);
  useEffect(() => {
    const caret = caretRef.current;
    caretRef.current = null;
    if (expanded) {
      everOpened.current = true;
      const ta2 = editorIn(sheetRef.current);
      if (!ta2)
        return;
      ta2.focus();
      if (caret)
        applyCaret(ta2, caret);
      return;
    }
    if (!everOpened.current)
      return;
    everOpened.current = false;
    const ta = editorIn(inlineRef.current);
    if (ta && caret)
      applyCaret(ta, caret);
    triggerRef.current?.focus();
  }, [expanded]);
  useEffect(() => {
    if (!expanded)
      return;
    const onKey = (e) => {
      if (isEscapeClose(e)) {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "Tab")
        return;
      const sheet = sheetRef.current;
      if (!sheet)
        return;
      const items = [...sheet.querySelectorAll(FOCUSABLE)];
      const active = document.activeElement;
      const next = trapTarget(items, active instanceof HTMLElement ? active : null, e.shiftKey);
      if (!next)
        return;
      e.preventDefault();
      next.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [expanded, close]);
  return /* @__PURE__ */ jsxDEV("div", {
    ref: inlineRef,
    className: styles_module_default.frame,
    children: [
      expanded ? /* @__PURE__ */ jsxDEV("div", {
        className: styles_module_default.away,
        children: "Editing fullscreen"
      }, undefined, false, undefined, this) : children,
      /* @__PURE__ */ jsxDEV("button", {
        type: "button",
        ref: triggerRef,
        className: `${styles_module_default.toggle} ${styles_module_default.inlineToggle}`,
        onClick: open,
        "aria-expanded": expanded,
        "aria-label": `Expand ${label}`,
        children: "Expand"
      }, undefined, false, undefined, this),
      expanded && createPortal(/* @__PURE__ */ jsxDEV("div", {
        className: styles_module_default.scrim,
        children: /* @__PURE__ */ jsxDEV("div", {
          ref: sheetRef,
          className: styles_module_default.sheet,
          role: "dialog",
          "aria-modal": "true",
          "aria-labelledby": titleId,
          children: [
            /* @__PURE__ */ jsxDEV("div", {
              className: styles_module_default.head,
              children: [
                /* @__PURE__ */ jsxDEV("span", {
                  className: styles_module_default.title,
                  id: titleId,
                  children: label
                }, undefined, false, undefined, this),
                /* @__PURE__ */ jsxDEV("span", {
                  className: styles_module_default.hint,
                  children: "Esc closes"
                }, undefined, false, undefined, this),
                /* @__PURE__ */ jsxDEV("button", {
                  type: "button",
                  className: styles_module_default.toggle,
                  onClick: close,
                  "aria-label": `Collapse ${label}`,
                  children: "Collapse"
                }, undefined, false, undefined, this)
              ]
            }, undefined, true, undefined, this),
            /* @__PURE__ */ jsxDEV("div", {
              className: styles_module_default.body,
              children
            }, undefined, false, undefined, this)
          ]
        }, undefined, true, undefined, this)
      }, undefined, false, undefined, this), document.body)
    ]
  }, undefined, true, undefined, this);
}

// src/ui/components/code-editor/highlight.ts
var kw = (...w) => new Set(w);
var LANGS = {
  js: { line: "//", block: ["/*", "*/"], strings: ['"', "'", "`"], keywords: kw("const", "let", "var", "function", "return", "if", "else", "for", "while", "of", "in", "new", "true", "false", "null", "undefined", "async", "await", "try", "catch", "class") },
  lua: { line: "--", block: ["--[[", "]]"], strings: ['"', "'"], keywords: kw("local", "function", "end", "if", "then", "else", "elseif", "return", "for", "while", "do", "repeat", "until", "and", "or", "not", "true", "false", "nil", "in") },
  css: { block: ["/*", "*/"], strings: ['"', "'"], keywords: kw() },
  html: { block: ["<!--", "-->"], strings: ['"', "'"], keywords: kw() },
  vars: { line: "#", strings: [], keywords: kw() },
  text: { strings: [], keywords: kw() }
};
var isWordChar = (c) => /[A-Za-z0-9_$]/.test(c);
var isDigit = (c) => c >= "0" && c <= "9";
function tokenize(code, lang = "text") {
  const rules = LANGS[lang] ?? LANGS.text;
  const out = [];
  let plain = "";
  const flush = () => {
    if (plain !== "")
      out.push({ type: "plain", text: plain });
    plain = "";
  };
  const push = (type, text) => {
    flush();
    out.push({ type, text });
  };
  let i = 0;
  const n = code.length;
  while (i < n) {
    const rest = code.slice(i);
    if (rest.startsWith("{{")) {
      const end = code.indexOf("}}", i + 2);
      const stop = end === -1 ? n : end + 2;
      push("macro", code.slice(i, stop));
      i = stop;
      continue;
    }
    if (rules.block && rest.startsWith(rules.block[0])) {
      const end = code.indexOf(rules.block[1], i + rules.block[0].length);
      const stop = end === -1 ? n : end + rules.block[1].length;
      push("comment", code.slice(i, stop));
      i = stop;
      continue;
    }
    if (rules.line && rest.startsWith(rules.line)) {
      const nl = code.indexOf(`
`, i);
      const stop = nl === -1 ? n : nl;
      push("comment", code.slice(i, stop));
      i = stop;
      continue;
    }
    const ch = code[i];
    if (rules.strings.includes(ch)) {
      let j = i + 1;
      while (j < n && code[j] !== ch) {
        if (code[j] === "\\")
          j += 1;
        j += 1;
      }
      const stop = Math.min(j + 1, n);
      push("string", code.slice(i, stop));
      i = stop;
      continue;
    }
    if (isDigit(ch)) {
      let j = i;
      while (j < n && /[0-9.]/.test(code[j]))
        j += 1;
      push("number", code.slice(i, j));
      i = j;
      continue;
    }
    if (isWordChar(ch)) {
      let j = i;
      while (j < n && isWordChar(code[j]))
        j += 1;
      const word = code.slice(i, j);
      if (rules.keywords.has(word))
        push("keyword", word);
      else
        plain += word;
      i = j;
      continue;
    }
    plain += ch;
    i += 1;
  }
  flush();
  return out;
}

// src/ui/components/code-editor/index.module.css
var index_module_default = {
  wrap: "wrap_2IOI8g",
  gutter: "gutter_2IOI8g",
  stack: "stack_2IOI8g",
  pre: "pre_2IOI8g",
  ta: "ta_2IOI8g",
  macro: "macro_2IOI8g",
  string: "string_2IOI8g",
  comment: "comment_2IOI8g",
  keyword: "keyword_2IOI8g",
  number: "number_2IOI8g",
  ac: "ac_2IOI8g",
  acHead: "acHead_2IOI8g",
  acItem: "acItem_2IOI8g",
  acItemOn: "acItemOn_2IOI8g",
  acSig: "acSig_2IOI8g",
  acDesc: "acDesc_2IOI8g",
  mirror: "mirror_2IOI8g"
};

// src/ui/components/code-editor/index.tsx
import { jsxDEV as jsxDEV2 } from "react/jsx-dev-runtime";
var DEFAULT_MACROS = [
  { sig: "getvar::name", desc: "read a variable" },
  { sig: "setvar::name::value", desc: "store a variable" },
  { sig: "tempvar::name::value", desc: "store, this turn only" },
  { sig: "gettempvar::name", desc: "read a temp variable" },
  { sig: "roll::N", desc: "random 1..N" },
  { sig: "random::a::b::c", desc: "pick one at random" },
  { sig: "calc::expr", desc: "do math" },
  { sig: "equal::a::b", desc: "a equals b" },
  { sig: "greater_equal::a::b", desc: "a >= b" },
  { sig: "less::a::b", desc: "a < b" },
  { sig: "char", desc: "character name" },
  { sig: "user", desc: "user name" }
];
function CodeEditor(props) {
  const { value, onChange, language = "text", placeholder, minRows = 8, macros = DEFAULT_MACROS } = props;
  const label = props.label ?? (language === "text" ? "Source" : `${language.toUpperCase()} source`);
  const taRef = useRef2(null);
  const preRef = useRef2(null);
  const gutterRef = useRef2(null);
  const mirrorRef = useRef2(null);
  const [ac, setAc] = useState2(null);
  const tokens = tokenize(value, language);
  const lineCount = Math.max(value.split(`
`).length, minRows);
  const gutter = Array.from({ length: lineCount }, (_, i) => i + 1).join(`
`);
  const syncScroll = () => {
    const ta = taRef.current;
    if (!ta)
      return;
    if (preRef.current) {
      preRef.current.scrollTop = ta.scrollTop;
      preRef.current.scrollLeft = ta.scrollLeft;
    }
    if (gutterRef.current)
      gutterRef.current.scrollTop = ta.scrollTop;
  };
  const macroTokenBefore = (ta) => {
    const upto = ta.value.slice(0, ta.selectionStart);
    const open = upto.lastIndexOf("{{");
    if (open === -1)
      return null;
    const between = upto.slice(open + 2);
    if (between.includes("}}"))
      return null;
    const query = between.split("::")[0] ?? "";
    if (!/^[a-z_]*$/i.test(query))
      return null;
    return { start: open, query };
  };
  const caretXY = (ta) => {
    const mirror = mirrorRef.current;
    if (!mirror)
      return { x: 0, y: 0 };
    const s = getComputedStyle(ta);
    for (const p of ["fontFamily", "fontSize", "fontWeight", "lineHeight", "paddingTop", "paddingLeft", "letterSpacing"]) {
      mirror.style[p] = s[p];
    }
    mirror.style.width = `${ta.clientWidth}px`;
    mirror.textContent = ta.value.slice(0, ta.selectionStart);
    const marker = document.createElement("span");
    marker.textContent = "​";
    mirror.appendChild(marker);
    const x = marker.offsetLeft - ta.scrollLeft;
    const y = marker.offsetTop - ta.scrollTop + (parseFloat(s.lineHeight) || 16);
    return { x, y };
  };
  const refreshAc = (ta) => {
    const tok = macroTokenBefore(ta);
    if (!tok) {
      setAc(null);
      return;
    }
    const items = macros.filter((m) => m.sig.toLowerCase().startsWith(tok.query.toLowerCase()));
    if (items.length === 0) {
      setAc(null);
      return;
    }
    const { x, y } = caretXY(ta);
    setAc({ items, index: 0, start: tok.start, x, y });
  };
  const insertMacro = () => {
    const ta = taRef.current;
    if (!ta || !ac)
      return;
    const chosen = ac.items[ac.index];
    const before = ta.value.slice(0, ac.start);
    const after = ta.value.slice(ta.selectionStart);
    const insert = `{{${chosen.sig}}}`;
    const next = before + insert + after;
    const caret = before.length + insert.length;
    onChange(next);
    setAc(null);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(caret, caret);
    });
  };
  const onKeyDown = (e) => {
    if (!ac)
      return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAc({ ...ac, index: (ac.index + 1) % ac.items.length });
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAc({ ...ac, index: (ac.index - 1 + ac.items.length) % ac.items.length });
    } else if (e.key === "Tab" || e.key === "Enter") {
      e.preventDefault();
      insertMacro();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setAc(null);
    }
  };
  const dropAc = useCallback2(() => setAc(null), []);
  return /* @__PURE__ */ jsxDEV2(ExpandBox, {
    label,
    onExpandedChange: dropAc,
    children: /* @__PURE__ */ jsxDEV2("div", {
      className: index_module_default.wrap,
      children: [
        /* @__PURE__ */ jsxDEV2("div", {
          className: index_module_default.gutter,
          ref: gutterRef,
          children: gutter
        }, undefined, false, undefined, this),
        /* @__PURE__ */ jsxDEV2("div", {
          className: index_module_default.stack,
          children: [
            /* @__PURE__ */ jsxDEV2("pre", {
              className: index_module_default.pre,
              ref: preRef,
              "aria-hidden": "true",
              children: [
                tokens.map((t, i) => /* @__PURE__ */ jsxDEV2("span", {
                  className: index_module_default[t.type],
                  children: t.text
                }, i, false, undefined, this)),
                `
`
              ]
            }, undefined, true, undefined, this),
            /* @__PURE__ */ jsxDEV2("textarea", {
              ref: taRef,
              className: index_module_default.ta,
              value,
              placeholder,
              spellCheck: false,
              style: { minHeight: `${minRows * 1.6}em` },
              onChange: (e) => {
                onChange(e.target.value);
                refreshAc(e.target);
              },
              onScroll: syncScroll,
              onKeyDown,
              onBlur: () => setTimeout(() => setAc(null), 120)
            }, undefined, false, undefined, this),
            ac && /* @__PURE__ */ jsxDEV2("div", {
              className: index_module_default.ac,
              style: { left: ac.x, top: ac.y },
              children: [
                /* @__PURE__ */ jsxDEV2("div", {
                  className: index_module_default.acHead,
                  children: "macros · tab to insert"
                }, undefined, false, undefined, this),
                ac.items.map((m, i) => /* @__PURE__ */ jsxDEV2("div", {
                  className: `${index_module_default.acItem}${i === ac.index ? ` ${index_module_default.acItemOn}` : ""}`,
                  onMouseDown: (e) => {
                    e.preventDefault();
                    setAc({ ...ac, index: i });
                    insertMacro();
                  },
                  children: [
                    /* @__PURE__ */ jsxDEV2("span", {
                      className: index_module_default.acSig,
                      children: `{{${m.sig}}}`
                    }, undefined, false, undefined, this),
                    /* @__PURE__ */ jsxDEV2("span", {
                      className: index_module_default.acDesc,
                      children: m.desc
                    }, undefined, false, undefined, this)
                  ]
                }, m.sig, true, undefined, this))
              ]
            }, undefined, true, undefined, this),
            /* @__PURE__ */ jsxDEV2("div", {
              className: index_module_default.mirror,
              ref: mirrorRef,
              "aria-hidden": "true"
            }, undefined, false, undefined, this)
          ]
        }, undefined, true, undefined, this)
      ]
    }, undefined, true, undefined, this)
  }, undefined, false, undefined, this);
}

// src/ui/components/paint-picker/index.tsx
import { useState as useState4 } from "react";

// src/ui/components/color-picker/index.tsx
import { useEffect as useEffect2, useRef as useRef3, useState as useState3 } from "react";

// src/ui/_shared/color-math.ts
var clamp01 = (n) => Math.min(1, Math.max(0, n));
function normalizeHex(input) {
  const raw = input.trim().replace(/^#/, "").toLowerCase();
  const full = raw.length === 3 ? raw.replace(/(.)/g, "$1$1") : raw;
  return /^[0-9a-f]{6}$/.test(full) ? `#${full}` : null;
}
function hexToHsv(hex) {
  const norm = normalizeHex(hex) ?? "#000000";
  const r = parseInt(norm.slice(1, 3), 16) / 255;
  const g = parseInt(norm.slice(3, 5), 16) / 255;
  const b = parseInt(norm.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r)
      h = (g - b) / d % 6;
    else if (max === g)
      h = (b - r) / d + 2;
    else
      h = (r - g) / d + 4;
    h *= 60;
    if (h < 0)
      h += 360;
  }
  const s = max === 0 ? 0 : d / max;
  return { h, s, v: max };
}
function hsvToHex({ h, s, v }) {
  const hue = (h % 360 + 360) % 360;
  const sat = clamp01(s);
  const val = clamp01(v);
  const c = val * sat;
  const x = c * (1 - Math.abs(hue / 60 % 2 - 1));
  const m = val - c;
  const [r, g, b] = hue < 60 ? [c, x, 0] : hue < 120 ? [x, c, 0] : hue < 180 ? [0, c, x] : hue < 240 ? [0, x, c] : hue < 300 ? [x, 0, c] : [c, 0, x];
  const to = (n) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}
function dragFraction(pos, origin, size) {
  return size === 0 ? 0 : clamp01((pos - origin) / size);
}

// src/ui/components/color-picker/styles.module.css
var styles_module_default2 = {
  cp: "cp_SWqr_A",
  sv: "sv_SWqr_A",
  hue: "hue_SWqr_A",
  thumb: "thumb_SWqr_A",
  foot: "foot_SWqr_A",
  chip: "chip_SWqr_A",
  hex: "hex_SWqr_A"
};

// src/ui/components/color-picker/index.tsx
import { jsxDEV as jsxDEV3 } from "react/jsx-dev-runtime";
function ColorPicker({ value, onChange }) {
  const [hsv, setHsv] = useState3(() => hexToHsv(value ?? "var(--rose)"));
  const [hexDraft, setHexDraft] = useState3(() => hsvToHex(hsv));
  const hexFocused = useRef3(false);
  const hsvRef = useRef3(hsv);
  hsvRef.current = hsv;
  useEffect2(() => {
    const norm = normalizeHex(value ?? "");
    if (!norm || norm === hsvToHex(hsvRef.current))
      return;
    setHsv(hexToHsv(norm));
    if (!hexFocused.current)
      setHexDraft(norm);
  }, [value]);
  const emit = (next) => {
    setHsv(next);
    const hex = hsvToHex(next);
    setHexDraft(hex);
    onChange(hex);
  };
  const dragSv = (rect, clientX, clientY) => {
    emit({
      ...hsv,
      s: dragFraction(clientX, rect.left, rect.width),
      v: 1 - dragFraction(clientY, rect.top, rect.height)
    });
  };
  const dragHue = (rect, clientX) => {
    emit({ ...hsv, h: dragFraction(clientX, rect.left, rect.width) * 360 });
  };
  const onSvPointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragSv(e.currentTarget.getBoundingClientRect(), e.clientX, e.clientY);
  };
  const onSvPointerMove = (e) => {
    if (e.buttons === 0)
      return;
    dragSv(e.currentTarget.getBoundingClientRect(), e.clientX, e.clientY);
  };
  const onHuePointerDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragHue(e.currentTarget.getBoundingClientRect(), e.clientX);
  };
  const onHuePointerMove = (e) => {
    if (e.buttons === 0)
      return;
    dragHue(e.currentTarget.getBoundingClientRect(), e.clientX);
  };
  const onHexChange = (e) => {
    setHexDraft(e.target.value);
    const norm = normalizeHex(e.target.value);
    if (!norm)
      return;
    setHsv(hexToHsv(norm));
    onChange(norm);
  };
  const pure = hsvToHex({ h: hsv.h, s: 1, v: 1 });
  const current = hsvToHex(hsv);
  return /* @__PURE__ */ jsxDEV3("div", {
    className: styles_module_default2.cp,
    children: [
      /* @__PURE__ */ jsxDEV3("div", {
        className: styles_module_default2.sv,
        style: {
          background: `linear-gradient(to top,var(--stage-black),transparent),linear-gradient(to right,var(--stage-white),${pure})`
        },
        onPointerDown: onSvPointerDown,
        onPointerMove: onSvPointerMove,
        children: /* @__PURE__ */ jsxDEV3("div", {
          className: styles_module_default2.thumb,
          style: { left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }
        }, undefined, false, undefined, this)
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV3("div", {
        className: styles_module_default2.hue,
        onPointerDown: onHuePointerDown,
        onPointerMove: onHuePointerMove,
        children: /* @__PURE__ */ jsxDEV3("div", {
          className: styles_module_default2.thumb,
          style: { left: `${hsv.h / 360 * 100}%`, top: "50%" }
        }, undefined, false, undefined, this)
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV3("div", {
        className: styles_module_default2.foot,
        children: [
          /* @__PURE__ */ jsxDEV3("div", {
            className: styles_module_default2.chip,
            style: { background: current }
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV3("input", {
            className: styles_module_default2.hex,
            spellCheck: false,
            "aria-label": "Hex color",
            value: hexDraft,
            onFocus: () => {
              hexFocused.current = true;
            },
            onBlur: () => {
              hexFocused.current = false;
              setHexDraft(current);
            },
            onChange: onHexChange
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this)
    ]
  }, undefined, true, undefined, this);
}

// src/ui/_shared/paint.ts
var solidPaint = (color = "#e11d48") => ({ kind: "solid", color });
var gradientPaint = (from = "#e11d48", to = "#f59e0b") => ({
  kind: "gradient",
  type: "linear",
  angle: 135,
  stops: [
    { color: from, at: 0 },
    { color: to, at: 1 }
  ]
});
var roundPct = (at) => `${Math.round(clamp01(at) * 1000) / 10}%`;
function paintToCss(p) {
  if (p.kind === "solid")
    return p.color;
  const stops = [...p.stops].sort((a, b) => a.at - b.at).map((s) => `${s.color} ${roundPct(s.at)}`);
  if (p.type === "radial")
    return `radial-gradient(circle, ${stops.join(", ")})`;
  return `linear-gradient(${Math.round(p.angle)}deg, ${stops.join(", ")})`;
}
var isRecord = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
function parseStop(raw) {
  if (!isRecord(raw))
    return null;
  const color = typeof raw.color === "string" ? normalizeHex(raw.color) : null;
  const at = typeof raw.at === "number" && Number.isFinite(raw.at) ? clamp01(raw.at) : null;
  return color && at !== null ? { color, at } : null;
}
function normalizePaint(raw) {
  if (!isRecord(raw))
    return null;
  if (raw.kind === "solid") {
    const color = typeof raw.color === "string" ? normalizeHex(raw.color) : null;
    return color ? { kind: "solid", color } : null;
  }
  if (raw.kind === "gradient") {
    const type = raw.type === "radial" ? "radial" : raw.type === "linear" ? "linear" : null;
    if (!type)
      return null;
    const angle = typeof raw.angle === "number" && Number.isFinite(raw.angle) ? raw.angle : 0;
    const stops = Array.isArray(raw.stops) ? raw.stops.map(parseStop).filter((s) => s !== null) : [];
    if (stops.length < 2)
      return null;
    return { kind: "gradient", type, angle: (angle % 360 + 360) % 360, stops: stops.sort((a, b) => a.at - b.at) };
  }
  return null;
}

// src/ui/components/paint-picker/styles.module.css
var styles_module_default3 = {
  pp: "pp_655Ssw",
  modes: "modes_655Ssw",
  on: "on_655Ssw",
  grad: "grad_655Ssw",
  bar: "bar_655Ssw",
  stop: "stop_655Ssw",
  sel: "sel_655Ssw",
  row: "row_655Ssw",
  out: "out_655Ssw",
  seg: "seg_655Ssw",
  rm: "rm_655Ssw",
  angle: "angle_655Ssw",
  deg: "deg_655Ssw"
};

// src/ui/components/paint-picker/index.tsx
import { jsxDEV as jsxDEV4 } from "react/jsx-dev-runtime";
var rgb = (hex) => {
  const n = parseInt((normalizeHex(hex) ?? "var(--stage-black)").slice(1), 16);
  return [n >> 16 & 255, n >> 8 & 255, n & 255];
};
var toHex = (n) => Math.round(n).toString(16).padStart(2, "0");
function lerpHex(a, b, t) {
  const [ar, ag, ab] = rgb(a);
  const [br, bg, bb] = rgb(b);
  return `#${toHex(ar + (br - ar) * t)}${toHex(ag + (bg - ag) * t)}${toHex(ab + (bb - ab) * t)}`;
}
function sampleAt(stops, f) {
  const sorted = [...stops].sort((s1, s2) => s1.at - s2.at);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (f <= first.at)
    return first.color;
  if (f >= last.at)
    return last.color;
  for (let i = 0;i < sorted.length - 1; i++) {
    const lo = sorted[i];
    const hi = sorted[i + 1];
    if (f >= lo.at && f <= hi.at)
      return lerpHex(lo.color, hi.color, (f - lo.at) / (hi.at - lo.at));
  }
  return last.color;
}
function clampToAllowed(paint, allow) {
  if (paint.kind === "gradient" && !allow.includes("gradient"))
    return solidPaint(paint.stops[0].color);
  if (paint.kind === "solid" && !allow.includes("solid"))
    return gradientPaint(paint.color);
  return paint;
}
function PaintPicker({ value, allow: allowProp, onChange }) {
  const allow = allowProp?.length ? allowProp : ["solid", "gradient"];
  const paint = clampToAllowed(normalizePaint(value) ?? solidPaint(), allow);
  const [sel, setSel] = useState4(0);
  const selClamped = paint.kind === "gradient" ? Math.min(sel, paint.stops.length - 1) : 0;
  const switchMode = (m) => {
    if (paint.kind === m)
      return;
    setSel(0);
    onChange(m === "gradient" ? gradientPaint(paint.kind === "solid" ? paint.color : undefined) : solidPaint(paint.kind === "gradient" ? paint.stops[0].color : undefined));
  };
  return /* @__PURE__ */ jsxDEV4("div", {
    className: styles_module_default3.pp,
    children: [
      allow.length > 1 && /* @__PURE__ */ jsxDEV4("div", {
        className: styles_module_default3.modes,
        children: ["solid", "gradient"].filter((m) => allow.includes(m)).map((m) => /* @__PURE__ */ jsxDEV4("button", {
          type: "button",
          className: paint.kind === m ? styles_module_default3.on : undefined,
          onClick: () => switchMode(m),
          children: m
        }, m, false, undefined, this))
      }, undefined, false, undefined, this),
      paint.kind === "solid" ? /* @__PURE__ */ jsxDEV4(ColorPicker, {
        value: paint.color,
        onChange: (hex) => onChange({ kind: "solid", color: hex })
      }, undefined, false, undefined, this) : /* @__PURE__ */ jsxDEV4(GradientEditor, {
        paint,
        sel: selClamped,
        onSel: setSel,
        onChange
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
function GradientEditor({
  paint,
  sel,
  onSel,
  onChange
}) {
  const stop = paint.stops[sel];
  const withStops = (stops) => ({ ...paint, stops });
  const onBarPointerDown = (e) => {
    if (e.target !== e.currentTarget)
      return;
    const rect = e.currentTarget.getBoundingClientRect();
    const f = dragFraction(e.clientX, rect.left, rect.width);
    const stops = [...paint.stops, { color: sampleAt(paint.stops, f), at: f }];
    onSel(stops.length - 1);
    onChange(withStops(stops));
  };
  const dragStop = (i, bar, clientX) => {
    const rect = bar.getBoundingClientRect();
    const f = dragFraction(clientX, rect.left, rect.width);
    onChange(withStops(paint.stops.map((s, idx) => idx === i ? { ...s, at: f } : s)));
  };
  const removeStop = () => {
    if (paint.stops.length <= 2)
      return;
    const stops = paint.stops.filter((_, i) => i !== sel);
    onSel(Math.min(sel, stops.length - 1));
    onChange(withStops(stops));
  };
  const barBg = `linear-gradient(90deg, ${[...paint.stops].sort((a, b) => a.at - b.at).map((s) => `${s.color} ${Math.round(s.at * 100)}%`).join(", ")})`;
  return /* @__PURE__ */ jsxDEV4("div", {
    className: styles_module_default3.grad,
    children: [
      /* @__PURE__ */ jsxDEV4("div", {
        className: styles_module_default3.bar,
        style: { background: barBg },
        onPointerDown: onBarPointerDown,
        children: paint.stops.map((s, i) => /* @__PURE__ */ jsxDEV4("span", {
          className: i === sel ? `${styles_module_default3.stop} ${styles_module_default3.sel}` : styles_module_default3.stop,
          style: { left: `${s.at * 100}%`, background: s.color },
          onPointerDown: (e) => {
            e.stopPropagation();
            e.currentTarget.setPointerCapture(e.pointerId);
            onSel(i);
          },
          onPointerMove: (e) => {
            if (e.buttons === 0)
              return;
            e.stopPropagation();
            dragStop(i, e.currentTarget.parentElement, e.clientX);
          }
        }, i, false, undefined, this))
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV4("div", {
        className: styles_module_default3.row,
        children: [
          /* @__PURE__ */ jsxDEV4("div", {
            className: styles_module_default3.out,
            style: { background: paintToCss(paint) }
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV4("div", {
            className: styles_module_default3.seg,
            children: ["linear", "radial"].map((t) => /* @__PURE__ */ jsxDEV4("button", {
              type: "button",
              className: paint.type === t ? styles_module_default3.on : undefined,
              onClick: () => onChange({ ...paint, type: t }),
              children: t
            }, t, false, undefined, this))
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV4("button", {
            type: "button",
            className: styles_module_default3.rm,
            disabled: paint.stops.length <= 2,
            onClick: removeStop,
            children: "remove"
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      paint.type === "linear" && /* @__PURE__ */ jsxDEV4("div", {
        className: styles_module_default3.angle,
        children: [
          /* @__PURE__ */ jsxDEV4("span", {
            className: styles_module_default3.deg,
            children: "angle"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV4("input", {
            type: "range",
            min: 0,
            max: 360,
            value: Math.round(paint.angle),
            onChange: (e) => onChange({ ...paint, angle: Number(e.target.value) })
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV4("span", {
            className: styles_module_default3.deg,
            children: [
              Math.round(paint.angle),
              "°"
            ]
          }, undefined, true, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV4(ColorPicker, {
        value: stop.color,
        onChange: (hex) => onChange(withStops(paint.stops.map((s, i) => i === sel ? { ...s, color: hex } : s)))
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}

// src/ui/components/slider/styles.module.css
var styles_module_default4 = {
  wrap: "wrap_iiNPuw",
  range: "range_iiNPuw",
  readout: "readout_iiNPuw"
};

// src/ui/components/slider/index.tsx
import { jsxDEV as jsxDEV5 } from "react/jsx-dev-runtime";
function Slider({
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
  "aria-label": ariaLabel
}) {
  return /* @__PURE__ */ jsxDEV5("div", {
    className: styles_module_default4.wrap,
    children: [
      /* @__PURE__ */ jsxDEV5("input", {
        type: "range",
        className: styles_module_default4.range,
        min,
        max,
        step,
        value,
        "aria-label": ariaLabel,
        onChange: (e) => onChange(Number(e.target.value))
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV5("span", {
        className: styles_module_default4.readout,
        children: format ? format(value) : String(value)
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}

// src/ui/components/toggle-switch/styles.module.css
var styles_module_default5 = {
  btn: "btn_-Rb0iw",
  track: "track_-Rb0iw",
  on: "on_-Rb0iw",
  knob: "knob_-Rb0iw"
};

// src/ui/components/toggle-switch/index.tsx
import { jsxDEV as jsxDEV6 } from "react/jsx-dev-runtime";
function ToggleSwitch({ on, onChange, label }) {
  return /* @__PURE__ */ jsxDEV6("button", {
    type: "button",
    role: "switch",
    "aria-checked": on,
    className: on ? `${styles_module_default5.btn} ${styles_module_default5.on}` : styles_module_default5.btn,
    onClick: () => onChange(!on),
    children: [
      /* @__PURE__ */ jsxDEV6("span", {
        className: styles_module_default5.track,
        children: /* @__PURE__ */ jsxDEV6("span", {
          className: styles_module_default5.knob
        }, undefined, false, undefined, this)
      }, undefined, false, undefined, this),
      label ? /* @__PURE__ */ jsxDEV6("span", {
        className: styles_module_default5.label,
        children: label
      }, undefined, false, undefined, this) : null
    ]
  }, undefined, true, undefined, this);
}

// src/ui/components/css-workshop/styles.module.css
var styles_module_default6 = {
  root: "root_3vyzkQ",
  banner: "banner_3vyzkQ",
  modeToggle: "modeToggle_3vyzkQ",
  modeBtn: "modeBtn_3vyzkQ",
  modeOn: "modeOn_3vyzkQ",
  tabs: "tabs_3vyzkQ",
  tab: "tab_3vyzkQ",
  tabOn: "tabOn_3vyzkQ",
  packRow: "packRow_3vyzkQ",
  packLabel: "packLabel_3vyzkQ",
  sel: "sel_3vyzkQ",
  recipe: "recipe_3vyzkQ",
  recipeHead: "recipeHead_3vyzkQ",
  recipeTitle: "recipeTitle_3vyzkQ",
  useBtn: "useBtn_3vyzkQ",
  blurb: "blurb_3vyzkQ",
  previewBlock: "previewBlock_3vyzkQ",
  frame: "frame_3vyzkQ",
  assist: "assist_3vyzkQ",
  ruleList: "ruleList_3vyzkQ",
  ruleBtn: "ruleBtn_3vyzkQ",
  ruleBtnOn: "ruleBtnOn_3vyzkQ",
  knobGrid: "knobGrid_3vyzkQ",
  knob: "knob_3vyzkQ",
  knobLabel: "knobLabel_3vyzkQ",
  row: "row_3vyzkQ",
  input: "input_3vyzkQ",
  check: "check_3vyzkQ",
  hint: "hint_3vyzkQ",
  english: "english_3vyzkQ",
  actions: "actions_3vyzkQ",
  mini: "mini_3vyzkQ",
  sourceHead: "sourceHead_3vyzkQ",
  sourceLabel: "sourceLabel_3vyzkQ",
  chips: "chips_3vyzkQ",
  chip: "chip_3vyzkQ",
  advanced: "advanced_3vyzkQ",
  advGrid: "advGrid_3vyzkQ",
  advCode: "advCode_3vyzkQ",
  advBreak: "advBreak_3vyzkQ",
  advKnobs: "advKnobs_3vyzkQ",
  freeformBlock: "freeformBlock_3vyzkQ",
  fileInput: "fileInput_3vyzkQ",
  importFlash: "importFlash_3vyzkQ"
};

// src/ui/components/css-workshop/knobs.tsx
import { jsxDEV as jsxDEV7 } from "react/jsx-dev-runtime";
var FONT_FAMILIES = [
  "system-ui, sans-serif",
  "Georgia, serif",
  "ui-monospace, monospace",
  'Georgia, "Times New Roman", serif',
  "system-ui, -apple-system, Segoe UI, sans-serif"
];
var parsePaintFromCss = (css) => {
  const t = css.trim();
  if (!t)
    return;
  if (/^#[0-9a-fA-F]{3,8}$/.test(t))
    return solidPaint(t);
  return;
};
function RuleKnobs({ rule, onChange }) {
  const bg = getProp(rule, "background") ?? getProp(rule, "background-color");
  const paintGuess = bg ? parsePaintFromCss(bg.value) : solidPaint("#1a1820");
  const color = getProp(rule, "color");
  const pad = getProp(rule, "padding");
  const radius = getProp(rule, "border-radius");
  const border = getProp(rule, "border");
  const shadow = getProp(rule, "box-shadow");
  const opacity = getProp(rule, "opacity");
  const fontSize = getProp(rule, "font-size");
  const fontWeight = getProp(rule, "font-weight");
  const fontFamily = getProp(rule, "font-family");
  const textAlign = getProp(rule, "text-align");
  const display = getProp(rule, "display");
  const important = Boolean(bg?.important || color?.important || pad?.important || radius?.important);
  const set = (property, value, imp = important) => {
    onChange(setProp(rule, property, value, imp));
  };
  const opacityNum = opacity ? Number.parseFloat(opacity.value) : 1;
  const opacitySafe = Number.isFinite(opacityNum) ? opacityNum : 1;
  return /* @__PURE__ */ jsxDEV7("div", {
    className: styles_module_default6.knobGrid,
    children: [
      /* @__PURE__ */ jsxDEV7("div", {
        className: styles_module_default6.knob,
        children: [
          /* @__PURE__ */ jsxDEV7("span", {
            className: styles_module_default6.knobLabel,
            children: "Selector"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV7("input", {
            className: styles_module_default6.input,
            value: rule.selector,
            onChange: (e) => onChange({ ...rule, selector: e.target.value }),
            spellCheck: false,
            "aria-label": "CSS selector"
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV7("div", {
        className: styles_module_default6.knob,
        children: [
          /* @__PURE__ */ jsxDEV7("span", {
            className: styles_module_default6.knobLabel,
            children: "Background"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV7(PaintPicker, {
            value: paintGuess ?? solidPaint("#1a1820"),
            onChange: (p) => {
              let next = setProp(rule, "background-color", "");
              next = setProp(next, "background-image", "");
              next = setProp(next, "background", paintToCss(p), important);
              onChange(next);
            }
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV7("input", {
            className: styles_module_default6.input,
            value: bg?.value ?? "",
            placeholder: "or type any CSS background",
            onChange: (e) => set("background", e.target.value),
            spellCheck: false
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV7("div", {
        className: styles_module_default6.knob,
        children: [
          /* @__PURE__ */ jsxDEV7("span", {
            className: styles_module_default6.knobLabel,
            children: "Text color"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV7("div", {
            className: styles_module_default6.row,
            children: [
              /* @__PURE__ */ jsxDEV7("input", {
                type: "color",
                value: /^#[0-9a-fA-F]{6}$/.test(color?.value ?? "") ? color.value : "#e8e4ef",
                onChange: (e) => set("color", e.target.value),
                "aria-label": "Text color swatch"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV7("input", {
                className: styles_module_default6.input,
                value: color?.value ?? "",
                placeholder: "#hex or name",
                onChange: (e) => set("color", e.target.value),
                spellCheck: false
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV7("div", {
        className: styles_module_default6.knob,
        children: [
          /* @__PURE__ */ jsxDEV7("span", {
            className: styles_module_default6.knobLabel,
            children: "Type"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV7("div", {
            className: styles_module_default6.row,
            children: [
              /* @__PURE__ */ jsxDEV7("input", {
                className: styles_module_default6.input,
                value: fontSize?.value ?? "",
                placeholder: "font-size e.g. 0.95rem",
                onChange: (e) => set("font-size", e.target.value),
                spellCheck: false
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV7("select", {
                className: styles_module_default6.sel,
                value: fontWeight?.value ?? "",
                onChange: (e) => set("font-weight", e.target.value),
                "aria-label": "Font weight",
                children: [
                  /* @__PURE__ */ jsxDEV7("option", {
                    value: "",
                    children: "weight"
                  }, undefined, false, undefined, this),
                  /* @__PURE__ */ jsxDEV7("option", {
                    value: "400",
                    children: "400"
                  }, undefined, false, undefined, this),
                  /* @__PURE__ */ jsxDEV7("option", {
                    value: "600",
                    children: "600"
                  }, undefined, false, undefined, this),
                  /* @__PURE__ */ jsxDEV7("option", {
                    value: "700",
                    children: "700"
                  }, undefined, false, undefined, this)
                ]
              }, undefined, true, undefined, this)
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ jsxDEV7("select", {
            className: styles_module_default6.sel,
            value: fontFamily?.value ?? "",
            onChange: (e) => set("font-family", e.target.value),
            "aria-label": "Font family",
            children: [
              /* @__PURE__ */ jsxDEV7("option", {
                value: "",
                children: "font family"
              }, undefined, false, undefined, this),
              FONT_FAMILIES.map((f) => /* @__PURE__ */ jsxDEV7("option", {
                value: f,
                children: f
              }, f, false, undefined, this))
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ jsxDEV7("select", {
            className: styles_module_default6.sel,
            value: textAlign?.value ?? "",
            onChange: (e) => set("text-align", e.target.value),
            "aria-label": "Text align",
            children: [
              /* @__PURE__ */ jsxDEV7("option", {
                value: "",
                children: "align"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV7("option", {
                value: "left",
                children: "left"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV7("option", {
                value: "center",
                children: "center"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV7("option", {
                value: "right",
                children: "right"
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV7("div", {
        className: styles_module_default6.knob,
        children: [
          /* @__PURE__ */ jsxDEV7("span", {
            className: styles_module_default6.knobLabel,
            children: "Box"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV7("div", {
            className: styles_module_default6.row,
            children: [
              /* @__PURE__ */ jsxDEV7("input", {
                className: styles_module_default6.input,
                value: pad?.value ?? "",
                placeholder: "padding e.g. 12px",
                onChange: (e) => set("padding", e.target.value),
                spellCheck: false
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV7("input", {
                className: styles_module_default6.input,
                value: radius?.value ?? "",
                placeholder: "radius e.g. 12px",
                onChange: (e) => set("border-radius", e.target.value),
                spellCheck: false
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ jsxDEV7("input", {
            className: styles_module_default6.input,
            value: border?.value ?? "",
            placeholder: "border e.g. 1px solid #333",
            onChange: (e) => set("border", e.target.value),
            spellCheck: false
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV7("input", {
            className: styles_module_default6.input,
            value: shadow?.value ?? "",
            placeholder: "box-shadow",
            onChange: (e) => set("box-shadow", e.target.value),
            spellCheck: false
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV7("div", {
        className: styles_module_default6.knob,
        children: [
          /* @__PURE__ */ jsxDEV7("span", {
            className: styles_module_default6.knobLabel,
            children: "Opacity"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV7(Slider, {
            value: opacitySafe,
            min: 0,
            max: 1,
            step: 0.05,
            format: (v) => v.toFixed(2),
            "aria-label": "Opacity",
            onChange: (v) => set("opacity", String(v))
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV7("div", {
        className: styles_module_default6.knob,
        children: [
          /* @__PURE__ */ jsxDEV7("span", {
            className: styles_module_default6.knobLabel,
            children: "Visibility"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV7("div", {
            className: styles_module_default6.row,
            children: [
              /* @__PURE__ */ jsxDEV7("button", {
                type: "button",
                className: styles_module_default6.mini,
                onClick: () => set("display", "none"),
                children: "hide"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV7("button", {
                type: "button",
                className: styles_module_default6.mini,
                onClick: () => {
                  let next = setProp(rule, "display", "");
                  next = setProp(next, "visibility", "");
                  onChange(next);
                },
                children: "show"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV7("span", {
                className: styles_module_default6.hint,
                children: display?.value === "none" ? "currently hidden" : "visible"
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV7(ToggleSwitch, {
        on: important,
        label: "force with !important (often needed on host sites)",
        onChange: (on) => {
          let next = rule;
          for (const d of rule.decls) {
            next = setProp(next, d.property, d.value, on);
          }
          onChange(next);
        }
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}

// src/ui/components/css-workshop/source-pane.tsx
import { jsxDEV as jsxDEV8 } from "react/jsx-dev-runtime";
var CSS_SNIPPET_CHIPS = [
  { label: "color", insert: "color: #e8e4ef;" },
  { label: "bg", insert: "background: #1a1820;" },
  { label: "radius", insert: "border-radius: 12px;" },
  { label: "pad", insert: "padding: 12px;" },
  { label: "border", insert: "border: 1px solid #3a3545;" },
  { label: "shadow", insert: "box-shadow: 0 8px 24px rgba(0,0,0,0.35);" },
  { label: "!imp", insert: "opacity: 1 !important;" }
];
function CssSourcePane({ value, onChange, onChip }) {
  return /* @__PURE__ */ jsxDEV8("div", {
    className: styles_module_default6.assist,
    "data-tour": "css-source",
    children: [
      /* @__PURE__ */ jsxDEV8("div", {
        className: styles_module_default6.sourceHead,
        children: /* @__PURE__ */ jsxDEV8("span", {
          className: styles_module_default6.sourceLabel,
          children: "Plain CSS source (truth)"
        }, undefined, false, undefined, this)
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV8("div", {
        className: styles_module_default6.chips,
        children: CSS_SNIPPET_CHIPS.map((c) => /* @__PURE__ */ jsxDEV8("button", {
          type: "button",
          className: styles_module_default6.chip,
          title: c.insert,
          onClick: () => onChip(c.insert),
          children: c.label
        }, c.label, false, undefined, this))
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV8(CodeEditor, {
        value,
        onChange,
        language: "css",
        minRows: 10,
        placeholder: `/* your CSS */
.card {
  color: #e8e4ef;
}
`,
        macros: []
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}

// src/ui/components/css-workshop/advanced-pane.tsx
import { jsxDEV as jsxDEV9 } from "react/jsx-dev-runtime";
function CssAdvancedPane({
  value,
  onChange,
  doc,
  selected,
  onSelectRule,
  onRuleChange,
  onChip
}) {
  const freeform = doc.freeform.trim();
  return /* @__PURE__ */ jsxDEV9("div", {
    className: styles_module_default6.advanced,
    "data-tour": "css-advanced",
    children: [
      /* @__PURE__ */ jsxDEV9("p", {
        className: styles_module_default6.hint,
        children: "Code is primary. Rules on the right are parsed from your sheet. Click one to tweak knobs; freeform (@media / nested) stays in the source."
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV9("div", {
        className: styles_module_default6.advGrid,
        children: [
          /* @__PURE__ */ jsxDEV9("div", {
            className: styles_module_default6.advCode,
            children: [
              /* @__PURE__ */ jsxDEV9("div", {
                className: styles_module_default6.sourceHead,
                children: /* @__PURE__ */ jsxDEV9("span", {
                  className: styles_module_default6.sourceLabel,
                  children: "CSS source"
                }, undefined, false, undefined, this)
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV9("div", {
                className: styles_module_default6.chips,
                children: CSS_SNIPPET_CHIPS.map((c) => /* @__PURE__ */ jsxDEV9("button", {
                  type: "button",
                  className: styles_module_default6.chip,
                  title: c.insert,
                  onClick: () => onChip(c.insert),
                  children: c.label
                }, c.label, false, undefined, this))
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV9(CodeEditor, {
                value,
                onChange,
                language: "css",
                minRows: 14,
                placeholder: `/* write CSS */
.card {
  color: #e8e4ef;
}
`,
                macros: []
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ jsxDEV9("div", {
            className: styles_module_default6.advBreak,
            children: [
              /* @__PURE__ */ jsxDEV9("span", {
                className: styles_module_default6.sourceLabel,
                children: [
                  "Rule breakdown · ",
                  doc.rules.length,
                  freeform ? " · freeform kept" : ""
                ]
              }, undefined, true, undefined, this),
              doc.rules.length === 0 && !freeform ? /* @__PURE__ */ jsxDEV9("p", {
                className: styles_module_default6.hint,
                children: "No rules parsed yet. Type CSS on the left or import a file."
              }, undefined, false, undefined, this) : null,
              /* @__PURE__ */ jsxDEV9("div", {
                className: styles_module_default6.ruleList,
                children: doc.rules.map((r) => /* @__PURE__ */ jsxDEV9("button", {
                  type: "button",
                  className: selected?.id === r.id ? `${styles_module_default6.ruleBtn} ${styles_module_default6.ruleBtnOn}` : styles_module_default6.ruleBtn,
                  onClick: () => onSelectRule(r.id),
                  children: summarizeRule(r)
                }, r.id, false, undefined, this))
              }, undefined, false, undefined, this),
              freeform ? /* @__PURE__ */ jsxDEV9("pre", {
                className: styles_module_default6.freeformBlock,
                title: "Unparsed / @media kept verbatim",
                children: freeform.length > 400 ? `${freeform.slice(0, 400)}…` : freeform
              }, undefined, false, undefined, this) : null,
              selected ? /* @__PURE__ */ jsxDEV9("div", {
                className: styles_module_default6.advKnobs,
                children: [
                  /* @__PURE__ */ jsxDEV9("span", {
                    className: styles_module_default6.knobLabel,
                    children: "Assist this rule"
                  }, undefined, false, undefined, this),
                  /* @__PURE__ */ jsxDEV9(RuleKnobs, {
                    rule: selected,
                    onChange: onRuleChange
                  }, undefined, false, undefined, this)
                ]
              }, undefined, true, undefined, this) : /* @__PURE__ */ jsxDEV9("p", {
                className: styles_module_default6.hint,
                children: "Select a rule to open knobs without leaving Advanced."
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this)
        ]
      }, undefined, true, undefined, this)
    ]
  }, undefined, true, undefined, this);
}

// src/ui/components/css-workshop/assist-pane.tsx
import { jsxDEV as jsxDEV10, Fragment } from "react/jsx-dev-runtime";
function CssAssistPane({
  pack,
  doc,
  selected,
  onSelectRule,
  onAddRule,
  onRuleChange,
  onDeleteRule
}) {
  return /* @__PURE__ */ jsxDEV10("div", {
    className: styles_module_default6.assist,
    "data-tour": "css-assist",
    children: [
      /* @__PURE__ */ jsxDEV10("p", {
        className: styles_module_default6.hint,
        children: "Pick a target, tweak knobs, or write free CSS in Source. Knobs edit one rule at a time."
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV10("div", {
        className: styles_module_default6.packRow,
        children: [
          /* @__PURE__ */ jsxDEV10("span", {
            className: styles_module_default6.packLabel,
            children: "Add rule for"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV10("select", {
            className: styles_module_default6.sel,
            defaultValue: "",
            onChange: (e) => {
              const t = pack.targets.find((x) => x.id === e.target.value);
              if (!t)
                return;
              onAddRule(t.selector || ".card");
              e.target.value = "";
            },
            "aria-label": "Add rule for target",
            children: [
              /* @__PURE__ */ jsxDEV10("option", {
                value: "",
                children: "choose target…"
              }, undefined, false, undefined, this),
              pack.targets.map((t) => /* @__PURE__ */ jsxDEV10("option", {
                value: t.id,
                children: [
                  t.label,
                  t.selector ? ` (${t.selector})` : ""
                ]
              }, t.id, true, undefined, this))
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ jsxDEV10("button", {
            type: "button",
            className: styles_module_default6.mini,
            onClick: () => onAddRule(".card"),
            children: "+ blank rule"
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      doc.rules.length === 0 ? /* @__PURE__ */ jsxDEV10("p", {
        className: styles_module_default6.hint,
        children: "No parsed rules yet. Use a Starter or open Source and write CSS."
      }, undefined, false, undefined, this) : /* @__PURE__ */ jsxDEV10("div", {
        className: styles_module_default6.ruleList,
        children: doc.rules.map((r) => /* @__PURE__ */ jsxDEV10("button", {
          type: "button",
          className: selected?.id === r.id ? `${styles_module_default6.ruleBtn} ${styles_module_default6.ruleBtnOn}` : styles_module_default6.ruleBtn,
          onClick: () => onSelectRule(r.id),
          children: summarizeRule(r)
        }, r.id, false, undefined, this))
      }, undefined, false, undefined, this),
      selected && /* @__PURE__ */ jsxDEV10(Fragment, {
        children: [
          /* @__PURE__ */ jsxDEV10("div", {
            className: styles_module_default6.english,
            children: summarizeRule(selected)
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV10(RuleKnobs, {
            rule: selected,
            onChange: onRuleChange
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV10("div", {
            className: styles_module_default6.actions,
            children: /* @__PURE__ */ jsxDEV10("button", {
              type: "button",
              className: styles_module_default6.mini,
              onClick: () => onDeleteRule(selected.id),
              children: "delete rule"
            }, undefined, false, undefined, this)
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      doc.freeform.trim() ? /* @__PURE__ */ jsxDEV10("p", {
        className: styles_module_default6.hint,
        children: "Extra CSS kept as freeform (@media / nested): edit in Source. Not dropped on save."
      }, undefined, false, undefined, this) : null
    ]
  }, undefined, true, undefined, this);
}

// src/ui/components/css-workshop/import-css.ts
async function readCssFile(file) {
  return file.text();
}
function summarizeImport(css) {
  const doc = parseCss(css);
  return {
    rules: doc.rules.length,
    freeform: doc.freeform.trim().length > 0,
    bytes: css.length
  };
}
var CSS_FILE_ACCEPT = ".css,text/css,text/plain";
function looksLikeCssFile(name) {
  const n = name.toLowerCase();
  return n.endsWith(".css") || n.endsWith(".txt") || n.endsWith(".scss");
}

// node_modules/dompurify/dist/purify.es.mjs
/*! @license DOMPurify 3.4.11 | (c) Cure53 and other contributors | Released under the Apache license 2.0 and Mozilla Public License 2.0 | github.com/cure53/DOMPurify/blob/3.4.11/LICENSE */
function _arrayLikeToArray(r, a) {
  (a == null || a > r.length) && (a = r.length);
  for (var e = 0, n = Array(a);e < a; e++)
    n[e] = r[e];
  return n;
}
function _arrayWithHoles(r) {
  if (Array.isArray(r))
    return r;
}
function _iterableToArrayLimit(r, l) {
  var t = r == null ? null : typeof Symbol != "undefined" && r[Symbol.iterator] || r["@@iterator"];
  if (t != null) {
    var e, n, i, u, a = [], f = true, o = false;
    try {
      if (i = (t = t.call(r)).next, l === 0)
        ;
      else
        for (;!(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = true)
          ;
    } catch (r2) {
      o = true, n = r2;
    } finally {
      try {
        if (!f && t.return != null && (u = t.return(), Object(u) !== u))
          return;
      } finally {
        if (o)
          throw n;
      }
    }
    return a;
  }
}
function _nonIterableRest() {
  throw new TypeError(`Invalid attempt to destructure non-iterable instance.
In order to be iterable, non-array objects must have a [Symbol.iterator]() method.`);
}
function _slicedToArray(r, e) {
  return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest();
}
function _unsupportedIterableToArray(r, a) {
  if (r) {
    if (typeof r == "string")
      return _arrayLikeToArray(r, a);
    var t = {}.toString.call(r).slice(8, -1);
    return t === "Object" && r.constructor && (t = r.constructor.name), t === "Map" || t === "Set" ? Array.from(r) : t === "Arguments" || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : undefined;
  }
}
var entries = Object.entries;
var setPrototypeOf = Object.setPrototypeOf;
var isFrozen = Object.isFrozen;
var getPrototypeOf = Object.getPrototypeOf;
var getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
var freeze = Object.freeze;
var seal = Object.seal;
var create = Object.create;
var _ref = typeof Reflect !== "undefined" && Reflect;
var apply = _ref.apply;
var construct = _ref.construct;
if (!freeze) {
  freeze = function freeze(x) {
    return x;
  };
}
if (!seal) {
  seal = function seal(x) {
    return x;
  };
}
if (!apply) {
  apply = function apply(func, thisArg) {
    for (var _len = arguments.length, args = new Array(_len > 2 ? _len - 2 : 0), _key = 2;_key < _len; _key++) {
      args[_key - 2] = arguments[_key];
    }
    return func.apply(thisArg, args);
  };
}
if (!construct) {
  construct = function construct(Func) {
    for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1;_key2 < _len2; _key2++) {
      args[_key2 - 1] = arguments[_key2];
    }
    return new Func(...args);
  };
}
var arrayForEach = unapply(Array.prototype.forEach);
var arrayLastIndexOf = unapply(Array.prototype.lastIndexOf);
var arrayPop = unapply(Array.prototype.pop);
var arrayPush = unapply(Array.prototype.push);
var arraySplice = unapply(Array.prototype.splice);
var arrayIsArray = Array.isArray;
var stringToLowerCase = unapply(String.prototype.toLowerCase);
var stringToString = unapply(String.prototype.toString);
var stringMatch = unapply(String.prototype.match);
var stringReplace = unapply(String.prototype.replace);
var stringIndexOf = unapply(String.prototype.indexOf);
var stringTrim = unapply(String.prototype.trim);
var numberToString = unapply(Number.prototype.toString);
var booleanToString = unapply(Boolean.prototype.toString);
var bigintToString = typeof BigInt === "undefined" ? null : unapply(BigInt.prototype.toString);
var symbolToString = typeof Symbol === "undefined" ? null : unapply(Symbol.prototype.toString);
var objectHasOwnProperty = unapply(Object.prototype.hasOwnProperty);
var objectToString = unapply(Object.prototype.toString);
var regExpTest = unapply(RegExp.prototype.test);
var typeErrorCreate = unconstruct(TypeError);
function unapply(func) {
  return function(thisArg) {
    if (thisArg instanceof RegExp) {
      thisArg.lastIndex = 0;
    }
    for (var _len3 = arguments.length, args = new Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1;_key3 < _len3; _key3++) {
      args[_key3 - 1] = arguments[_key3];
    }
    return apply(func, thisArg, args);
  };
}
function unconstruct(Func) {
  return function() {
    for (var _len4 = arguments.length, args = new Array(_len4), _key4 = 0;_key4 < _len4; _key4++) {
      args[_key4] = arguments[_key4];
    }
    return construct(Func, args);
  };
}
function addToSet(set, array) {
  let transformCaseFunc = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : stringToLowerCase;
  if (setPrototypeOf) {
    setPrototypeOf(set, null);
  }
  if (!arrayIsArray(array)) {
    return set;
  }
  let l = array.length;
  while (l--) {
    let element = array[l];
    if (typeof element === "string") {
      const lcElement = transformCaseFunc(element);
      if (lcElement !== element) {
        if (!isFrozen(array)) {
          array[l] = lcElement;
        }
        element = lcElement;
      }
    }
    set[element] = true;
  }
  return set;
}
function cleanArray(array) {
  for (let index = 0;index < array.length; index++) {
    const isPropertyExist = objectHasOwnProperty(array, index);
    if (!isPropertyExist) {
      array[index] = null;
    }
  }
  return array;
}
function clone(object) {
  const newObject = create(null);
  for (const _ref2 of entries(object)) {
    var _ref3 = _slicedToArray(_ref2, 2);
    const property = _ref3[0];
    const value = _ref3[1];
    const isPropertyExist = objectHasOwnProperty(object, property);
    if (isPropertyExist) {
      if (arrayIsArray(value)) {
        newObject[property] = cleanArray(value);
      } else if (value && typeof value === "object" && value.constructor === Object) {
        newObject[property] = clone(value);
      } else {
        newObject[property] = value;
      }
    }
  }
  return newObject;
}
function stringifyValue(value) {
  switch (typeof value) {
    case "string": {
      return value;
    }
    case "number": {
      return numberToString(value);
    }
    case "boolean": {
      return booleanToString(value);
    }
    case "bigint": {
      return bigintToString ? bigintToString(value) : "0";
    }
    case "symbol": {
      return symbolToString ? symbolToString(value) : "Symbol()";
    }
    case "undefined": {
      return objectToString(value);
    }
    case "function":
    case "object": {
      if (value === null) {
        return objectToString(value);
      }
      const valueAsRecord = value;
      const valueToString = lookupGetter(valueAsRecord, "toString");
      if (typeof valueToString === "function") {
        const stringified = valueToString(valueAsRecord);
        return typeof stringified === "string" ? stringified : objectToString(stringified);
      }
      return objectToString(value);
    }
    default: {
      return objectToString(value);
    }
  }
}
function lookupGetter(object, prop) {
  while (object !== null) {
    const desc = getOwnPropertyDescriptor(object, prop);
    if (desc) {
      if (desc.get) {
        return unapply(desc.get);
      }
      if (typeof desc.value === "function") {
        return unapply(desc.value);
      }
    }
    object = getPrototypeOf(object);
  }
  function fallbackValue() {
    return null;
  }
  return fallbackValue;
}
function isRegex(value) {
  try {
    regExpTest(value, "");
    return true;
  } catch (_unused) {
    return false;
  }
}
var html$1 = freeze(["a", "abbr", "acronym", "address", "area", "article", "aside", "audio", "b", "bdi", "bdo", "big", "blink", "blockquote", "body", "br", "button", "canvas", "caption", "center", "cite", "code", "col", "colgroup", "content", "data", "datalist", "dd", "decorator", "del", "details", "dfn", "dialog", "dir", "div", "dl", "dt", "element", "em", "fieldset", "figcaption", "figure", "font", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "head", "header", "hgroup", "hr", "html", "i", "img", "input", "ins", "kbd", "label", "legend", "li", "main", "map", "mark", "marquee", "menu", "menuitem", "meter", "nav", "nobr", "ol", "optgroup", "option", "output", "p", "picture", "pre", "progress", "q", "rp", "rt", "ruby", "s", "samp", "search", "section", "select", "shadow", "slot", "small", "source", "spacer", "span", "strike", "strong", "style", "sub", "summary", "sup", "table", "tbody", "td", "template", "textarea", "tfoot", "th", "thead", "time", "tr", "track", "tt", "u", "ul", "var", "video", "wbr"]);
var svg$1 = freeze(["svg", "a", "altglyph", "altglyphdef", "altglyphitem", "animatecolor", "animatemotion", "animatetransform", "circle", "clippath", "defs", "desc", "ellipse", "enterkeyhint", "exportparts", "filter", "font", "g", "glyph", "glyphref", "hkern", "image", "inputmode", "line", "lineargradient", "marker", "mask", "metadata", "mpath", "part", "path", "pattern", "polygon", "polyline", "radialgradient", "rect", "stop", "style", "switch", "symbol", "text", "textpath", "title", "tref", "tspan", "view", "vkern"]);
var svgFilters = freeze(["feBlend", "feColorMatrix", "feComponentTransfer", "feComposite", "feConvolveMatrix", "feDiffuseLighting", "feDisplacementMap", "feDistantLight", "feDropShadow", "feFlood", "feFuncA", "feFuncB", "feFuncG", "feFuncR", "feGaussianBlur", "feImage", "feMerge", "feMergeNode", "feMorphology", "feOffset", "fePointLight", "feSpecularLighting", "feSpotLight", "feTile", "feTurbulence"]);
var svgDisallowed = freeze(["animate", "color-profile", "cursor", "discard", "font-face", "font-face-format", "font-face-name", "font-face-src", "font-face-uri", "foreignobject", "hatch", "hatchpath", "mesh", "meshgradient", "meshpatch", "meshrow", "missing-glyph", "script", "set", "solidcolor", "unknown", "use"]);
var mathMl$1 = freeze(["math", "menclose", "merror", "mfenced", "mfrac", "mglyph", "mi", "mlabeledtr", "mmultiscripts", "mn", "mo", "mover", "mpadded", "mphantom", "mroot", "mrow", "ms", "mspace", "msqrt", "mstyle", "msub", "msup", "msubsup", "mtable", "mtd", "mtext", "mtr", "munder", "munderover", "mprescripts"]);
var mathMlDisallowed = freeze(["maction", "maligngroup", "malignmark", "mlongdiv", "mscarries", "mscarry", "msgroup", "mstack", "msline", "msrow", "semantics", "annotation", "annotation-xml", "mprescripts", "none"]);
var text = freeze(["#text"]);
var html = freeze(["accept", "action", "align", "alt", "autocapitalize", "autocomplete", "autopictureinpicture", "autoplay", "background", "bgcolor", "border", "capture", "cellpadding", "cellspacing", "checked", "cite", "class", "clear", "color", "cols", "colspan", "command", "commandfor", "controls", "controlslist", "coords", "crossorigin", "datetime", "decoding", "default", "dir", "disabled", "disablepictureinpicture", "disableremoteplayback", "download", "draggable", "enctype", "enterkeyhint", "exportparts", "face", "for", "headers", "height", "hidden", "high", "href", "hreflang", "id", "inert", "inputmode", "integrity", "ismap", "kind", "label", "lang", "list", "loading", "loop", "low", "max", "maxlength", "media", "method", "min", "minlength", "multiple", "muted", "name", "nonce", "noshade", "novalidate", "nowrap", "open", "optimum", "part", "pattern", "placeholder", "playsinline", "popover", "popovertarget", "popovertargetaction", "poster", "preload", "pubdate", "radiogroup", "readonly", "rel", "required", "rev", "reversed", "role", "rows", "rowspan", "spellcheck", "scope", "selected", "shape", "size", "sizes", "slot", "span", "srclang", "start", "src", "srcset", "step", "style", "summary", "tabindex", "title", "translate", "type", "usemap", "valign", "value", "width", "wrap", "xmlns"]);
var svg = freeze(["accent-height", "accumulate", "additive", "alignment-baseline", "amplitude", "ascent", "attributename", "attributetype", "azimuth", "basefrequency", "baseline-shift", "begin", "bias", "by", "class", "clip", "clippathunits", "clip-path", "clip-rule", "color", "color-interpolation", "color-interpolation-filters", "color-profile", "color-rendering", "cx", "cy", "d", "dx", "dy", "diffuseconstant", "direction", "display", "divisor", "dur", "edgemode", "elevation", "end", "exponent", "fill", "fill-opacity", "fill-rule", "filter", "filterunits", "flood-color", "flood-opacity", "font-family", "font-size", "font-size-adjust", "font-stretch", "font-style", "font-variant", "font-weight", "fx", "fy", "g1", "g2", "glyph-name", "glyphref", "gradientunits", "gradienttransform", "height", "href", "id", "image-rendering", "in", "in2", "intercept", "k", "k1", "k2", "k3", "k4", "kerning", "keypoints", "keysplines", "keytimes", "lang", "lengthadjust", "letter-spacing", "kernelmatrix", "kernelunitlength", "lighting-color", "local", "marker-end", "marker-mid", "marker-start", "markerheight", "markerunits", "markerwidth", "maskcontentunits", "maskunits", "max", "mask", "mask-type", "media", "method", "mode", "min", "name", "numoctaves", "offset", "operator", "opacity", "order", "orient", "orientation", "origin", "overflow", "paint-order", "path", "pathlength", "patterncontentunits", "patterntransform", "patternunits", "points", "preservealpha", "preserveaspectratio", "primitiveunits", "r", "rx", "ry", "radius", "refx", "refy", "repeatcount", "repeatdur", "restart", "result", "rotate", "scale", "seed", "shape-rendering", "slope", "specularconstant", "specularexponent", "spreadmethod", "startoffset", "stddeviation", "stitchtiles", "stop-color", "stop-opacity", "stroke-dasharray", "stroke-dashoffset", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "stroke-opacity", "stroke", "stroke-width", "style", "surfacescale", "systemlanguage", "tabindex", "tablevalues", "targetx", "targety", "transform", "transform-origin", "text-anchor", "text-decoration", "text-rendering", "textlength", "type", "u1", "u2", "unicode", "values", "viewbox", "visibility", "version", "vert-adv-y", "vert-origin-x", "vert-origin-y", "width", "word-spacing", "wrap", "writing-mode", "xchannelselector", "ychannelselector", "x", "x1", "x2", "xmlns", "y", "y1", "y2", "z", "zoomandpan"]);
var mathMl = freeze(["accent", "accentunder", "align", "bevelled", "close", "columnalign", "columnlines", "columnspacing", "columnspan", "denomalign", "depth", "dir", "display", "displaystyle", "encoding", "fence", "frame", "height", "href", "id", "largeop", "length", "linethickness", "lquote", "lspace", "mathbackground", "mathcolor", "mathsize", "mathvariant", "maxsize", "minsize", "movablelimits", "notation", "numalign", "open", "rowalign", "rowlines", "rowspacing", "rowspan", "rspace", "rquote", "scriptlevel", "scriptminsize", "scriptsizemultiplier", "selection", "separator", "separators", "stretchy", "subscriptshift", "supscriptshift", "symmetric", "voffset", "width", "xmlns"]);
var xml = freeze(["xlink:href", "xml:id", "xlink:title", "xml:space", "xmlns:xlink"]);
var MUSTACHE_EXPR = seal(/{{[\w\W]*|^[\w\W]*}}/g);
var ERB_EXPR = seal(/<%[\w\W]*|^[\w\W]*%>/g);
var TMPLIT_EXPR = seal(/\${[\w\W]*/g);
var DATA_ATTR = seal(/^data-[\-\w.\u00B7-\uFFFF]+$/);
var ARIA_ATTR = seal(/^aria-[\-\w]+$/);
var IS_ALLOWED_URI = seal(/^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i);
var IS_SCRIPT_OR_DATA = seal(/^(?:\w+script|data):/i);
var ATTR_WHITESPACE = seal(/[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u2029\u205F\u3000]/g);
var DOCTYPE_NAME = seal(/^html$/i);
var CUSTOM_ELEMENT = seal(/^[a-z][.\w]*(-[.\w]+)+$/i);
var ELEMENT_MARKUP_PROBE = seal(/<[/\w!]/g);
var COMMENT_MARKUP_PROBE = seal(/<[/\w]/g);
var FALLBACK_TAG_CLOSE = seal(/<\/no(script|embed|frames)/i);
var SELF_CLOSING_TAG = seal(/\/>/i);
var NODE_TYPE = {
  element: 1,
  attribute: 2,
  text: 3,
  cdataSection: 4,
  entityReference: 5,
  entityNode: 6,
  processingInstruction: 7,
  comment: 8,
  document: 9,
  documentType: 10,
  documentFragment: 11,
  notation: 12
};
var getGlobal = function getGlobal2() {
  return typeof window === "undefined" ? null : window;
};
var _createTrustedTypesPolicy = function _createTrustedTypesPolicy2(trustedTypes, purifyHostElement) {
  if (typeof trustedTypes !== "object" || typeof trustedTypes.createPolicy !== "function") {
    return null;
  }
  let suffix = null;
  const ATTR_NAME = "data-tt-policy-suffix";
  if (purifyHostElement && purifyHostElement.hasAttribute(ATTR_NAME)) {
    suffix = purifyHostElement.getAttribute(ATTR_NAME);
  }
  const policyName = "dompurify" + (suffix ? "#" + suffix : "");
  try {
    return trustedTypes.createPolicy(policyName, {
      createHTML(html2) {
        return html2;
      },
      createScriptURL(scriptUrl) {
        return scriptUrl;
      }
    });
  } catch (_) {
    console.warn("TrustedTypes policy " + policyName + " could not be created.");
    return null;
  }
};
var _createHooksMap = function _createHooksMap2() {
  return {
    afterSanitizeAttributes: [],
    afterSanitizeElements: [],
    afterSanitizeShadowDOM: [],
    beforeSanitizeAttributes: [],
    beforeSanitizeElements: [],
    beforeSanitizeShadowDOM: [],
    uponSanitizeAttribute: [],
    uponSanitizeElement: [],
    uponSanitizeShadowNode: []
  };
};
var _resolveSetOption = function _resolveSetOption2(cfg, key, fallback, options) {
  return objectHasOwnProperty(cfg, key) && arrayIsArray(cfg[key]) ? addToSet(options.base ? clone(options.base) : {}, cfg[key], options.transform) : fallback;
};
function createDOMPurify() {
  let window2 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : getGlobal();
  const DOMPurify = (root) => createDOMPurify(root);
  DOMPurify.version = "3.4.11";
  DOMPurify.removed = [];
  if (!window2 || !window2.document || window2.document.nodeType !== NODE_TYPE.document || !window2.Element) {
    DOMPurify.isSupported = false;
    return DOMPurify;
  }
  let document2 = window2.document;
  const originalDocument = document2;
  const currentScript = originalDocument.currentScript;
  window2.DocumentFragment;
  const { HTMLTemplateElement, Node, Element: Element2, NodeFilter, NamedNodeMap: _window$NamedNodeMap } = window2;
  _window$NamedNodeMap === undefined && (window2.NamedNodeMap || window2.MozNamedAttrMap);
  window2.HTMLFormElement;
  const { DOMParser, trustedTypes } = window2;
  const ElementPrototype = Element2.prototype;
  const cloneNode = lookupGetter(ElementPrototype, "cloneNode");
  const remove = lookupGetter(ElementPrototype, "remove");
  const getNextSibling = lookupGetter(ElementPrototype, "nextSibling");
  const getChildNodes = lookupGetter(ElementPrototype, "childNodes");
  const getParentNode = lookupGetter(ElementPrototype, "parentNode");
  const getShadowRoot = lookupGetter(ElementPrototype, "shadowRoot");
  const getAttributes = lookupGetter(ElementPrototype, "attributes");
  const getNodeType = Node && Node.prototype ? lookupGetter(Node.prototype, "nodeType") : null;
  const getNodeName = Node && Node.prototype ? lookupGetter(Node.prototype, "nodeName") : null;
  if (typeof HTMLTemplateElement === "function") {
    const template = document2.createElement("template");
    if (template.content && template.content.ownerDocument) {
      document2 = template.content.ownerDocument;
    }
  }
  let trustedTypesPolicy;
  let emptyHTML = "";
  let defaultTrustedTypesPolicy;
  let defaultTrustedTypesPolicyResolved = false;
  let IN_TRUSTED_TYPES_POLICY = 0;
  const _assertNotInTrustedTypesPolicy = function _assertNotInTrustedTypesPolicy() {
    if (IN_TRUSTED_TYPES_POLICY > 0) {
      throw typeErrorCreate("A configured TRUSTED_TYPES_POLICY callback (createHTML or " + "createScriptURL) must not call DOMPurify.sanitize, as that causes " + "infinite recursion. Do not pass a policy whose callbacks wrap " + 'DOMPurify as TRUSTED_TYPES_POLICY; see the "DOMPurify and Trusted ' + 'Types" section of the README.');
    }
  };
  const _createTrustedHTML = function _createTrustedHTML(html2) {
    _assertNotInTrustedTypesPolicy();
    IN_TRUSTED_TYPES_POLICY++;
    try {
      return trustedTypesPolicy.createHTML(html2);
    } finally {
      IN_TRUSTED_TYPES_POLICY--;
    }
  };
  const _createTrustedScriptURL = function _createTrustedScriptURL(scriptUrl) {
    _assertNotInTrustedTypesPolicy();
    IN_TRUSTED_TYPES_POLICY++;
    try {
      return trustedTypesPolicy.createScriptURL(scriptUrl);
    } finally {
      IN_TRUSTED_TYPES_POLICY--;
    }
  };
  const _getDefaultTrustedTypesPolicy = function _getDefaultTrustedTypesPolicy() {
    if (!defaultTrustedTypesPolicyResolved) {
      defaultTrustedTypesPolicy = _createTrustedTypesPolicy(trustedTypes, currentScript);
      defaultTrustedTypesPolicyResolved = true;
    }
    return defaultTrustedTypesPolicy;
  };
  const _document = document2, implementation = _document.implementation, createNodeIterator = _document.createNodeIterator, createDocumentFragment = _document.createDocumentFragment, getElementsByTagName = _document.getElementsByTagName;
  const importNode = originalDocument.importNode;
  let hooks = _createHooksMap();
  DOMPurify.isSupported = typeof entries === "function" && typeof getParentNode === "function" && implementation && implementation.createHTMLDocument !== undefined;
  const MUSTACHE_EXPR$1 = MUSTACHE_EXPR, ERB_EXPR$1 = ERB_EXPR, TMPLIT_EXPR$1 = TMPLIT_EXPR, DATA_ATTR$1 = DATA_ATTR, ARIA_ATTR$1 = ARIA_ATTR, IS_SCRIPT_OR_DATA$1 = IS_SCRIPT_OR_DATA, ATTR_WHITESPACE$1 = ATTR_WHITESPACE, CUSTOM_ELEMENT$1 = CUSTOM_ELEMENT;
  let IS_ALLOWED_URI$1 = IS_ALLOWED_URI;
  let ALLOWED_TAGS = null;
  const DEFAULT_ALLOWED_TAGS = addToSet({}, [...html$1, ...svg$1, ...svgFilters, ...mathMl$1, ...text]);
  let ALLOWED_ATTR = null;
  const DEFAULT_ALLOWED_ATTR = addToSet({}, [...html, ...svg, ...mathMl, ...xml]);
  let CUSTOM_ELEMENT_HANDLING = Object.seal(create(null, {
    tagNameCheck: {
      writable: true,
      configurable: false,
      enumerable: true,
      value: null
    },
    attributeNameCheck: {
      writable: true,
      configurable: false,
      enumerable: true,
      value: null
    },
    allowCustomizedBuiltInElements: {
      writable: true,
      configurable: false,
      enumerable: true,
      value: false
    }
  }));
  let FORBID_TAGS = null;
  let FORBID_ATTR = null;
  const EXTRA_ELEMENT_HANDLING = Object.seal(create(null, {
    tagCheck: {
      writable: true,
      configurable: false,
      enumerable: true,
      value: null
    },
    attributeCheck: {
      writable: true,
      configurable: false,
      enumerable: true,
      value: null
    }
  }));
  let ALLOW_ARIA_ATTR = true;
  let ALLOW_DATA_ATTR = true;
  let ALLOW_UNKNOWN_PROTOCOLS = false;
  let ALLOW_SELF_CLOSE_IN_ATTR = true;
  let SAFE_FOR_TEMPLATES = false;
  let SAFE_FOR_XML = true;
  let WHOLE_DOCUMENT = false;
  let SET_CONFIG = false;
  let SET_CONFIG_ALLOWED_TAGS = null;
  let SET_CONFIG_ALLOWED_ATTR = null;
  let FORCE_BODY = false;
  let RETURN_DOM = false;
  let RETURN_DOM_FRAGMENT = false;
  let RETURN_TRUSTED_TYPE = false;
  let SANITIZE_DOM = true;
  let SANITIZE_NAMED_PROPS = false;
  const SANITIZE_NAMED_PROPS_PREFIX = "user-content-";
  let KEEP_CONTENT = true;
  let IN_PLACE = false;
  let USE_PROFILES = {};
  let FORBID_CONTENTS = null;
  const DEFAULT_FORBID_CONTENTS = addToSet({}, [
    "annotation-xml",
    "audio",
    "colgroup",
    "desc",
    "foreignobject",
    "head",
    "iframe",
    "math",
    "mi",
    "mn",
    "mo",
    "ms",
    "mtext",
    "noembed",
    "noframes",
    "noscript",
    "plaintext",
    "script",
    "selectedcontent",
    "style",
    "svg",
    "template",
    "thead",
    "title",
    "video",
    "xmp"
  ]);
  let DATA_URI_TAGS = null;
  const DEFAULT_DATA_URI_TAGS = addToSet({}, ["audio", "video", "img", "source", "image", "track"]);
  let URI_SAFE_ATTRIBUTES = null;
  const DEFAULT_URI_SAFE_ATTRIBUTES = addToSet({}, ["alt", "class", "for", "id", "label", "name", "pattern", "placeholder", "role", "summary", "title", "value", "style", "xmlns"]);
  const MATHML_NAMESPACE = "http://www.w3.org/1998/Math/MathML";
  const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
  const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
  let NAMESPACE = HTML_NAMESPACE;
  let IS_EMPTY_INPUT = false;
  let ALLOWED_NAMESPACES = null;
  const DEFAULT_ALLOWED_NAMESPACES = addToSet({}, [MATHML_NAMESPACE, SVG_NAMESPACE, HTML_NAMESPACE], stringToString);
  const DEFAULT_MATHML_TEXT_INTEGRATION_POINTS = freeze(["mi", "mo", "mn", "ms", "mtext"]);
  let MATHML_TEXT_INTEGRATION_POINTS = addToSet({}, DEFAULT_MATHML_TEXT_INTEGRATION_POINTS);
  const DEFAULT_HTML_INTEGRATION_POINTS = freeze(["annotation-xml"]);
  let HTML_INTEGRATION_POINTS = addToSet({}, DEFAULT_HTML_INTEGRATION_POINTS);
  const COMMON_SVG_AND_HTML_ELEMENTS = addToSet({}, ["title", "style", "font", "a", "script"]);
  let PARSER_MEDIA_TYPE = null;
  const SUPPORTED_PARSER_MEDIA_TYPES = ["application/xhtml+xml", "text/html"];
  const DEFAULT_PARSER_MEDIA_TYPE = "text/html";
  let transformCaseFunc = null;
  let CONFIG = null;
  const formElement = document2.createElement("form");
  const isRegexOrFunction = function isRegexOrFunction(testValue) {
    return testValue instanceof RegExp || testValue instanceof Function;
  };
  const _parseConfig = function _parseConfig() {
    let cfg = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    if (CONFIG && CONFIG === cfg) {
      return;
    }
    if (!cfg || typeof cfg !== "object") {
      cfg = {};
    }
    cfg = clone(cfg);
    PARSER_MEDIA_TYPE = SUPPORTED_PARSER_MEDIA_TYPES.indexOf(cfg.PARSER_MEDIA_TYPE) === -1 ? DEFAULT_PARSER_MEDIA_TYPE : cfg.PARSER_MEDIA_TYPE;
    transformCaseFunc = PARSER_MEDIA_TYPE === "application/xhtml+xml" ? stringToString : stringToLowerCase;
    ALLOWED_TAGS = _resolveSetOption(cfg, "ALLOWED_TAGS", DEFAULT_ALLOWED_TAGS, {
      transform: transformCaseFunc
    });
    ALLOWED_ATTR = _resolveSetOption(cfg, "ALLOWED_ATTR", DEFAULT_ALLOWED_ATTR, {
      transform: transformCaseFunc
    });
    ALLOWED_NAMESPACES = _resolveSetOption(cfg, "ALLOWED_NAMESPACES", DEFAULT_ALLOWED_NAMESPACES, {
      transform: stringToString
    });
    URI_SAFE_ATTRIBUTES = _resolveSetOption(cfg, "ADD_URI_SAFE_ATTR", DEFAULT_URI_SAFE_ATTRIBUTES, {
      transform: transformCaseFunc,
      base: DEFAULT_URI_SAFE_ATTRIBUTES
    });
    DATA_URI_TAGS = _resolveSetOption(cfg, "ADD_DATA_URI_TAGS", DEFAULT_DATA_URI_TAGS, {
      transform: transformCaseFunc,
      base: DEFAULT_DATA_URI_TAGS
    });
    FORBID_CONTENTS = _resolveSetOption(cfg, "FORBID_CONTENTS", DEFAULT_FORBID_CONTENTS, {
      transform: transformCaseFunc
    });
    FORBID_TAGS = _resolveSetOption(cfg, "FORBID_TAGS", clone({}), {
      transform: transformCaseFunc
    });
    FORBID_ATTR = _resolveSetOption(cfg, "FORBID_ATTR", clone({}), {
      transform: transformCaseFunc
    });
    USE_PROFILES = objectHasOwnProperty(cfg, "USE_PROFILES") ? cfg.USE_PROFILES && typeof cfg.USE_PROFILES === "object" ? clone(cfg.USE_PROFILES) : cfg.USE_PROFILES : false;
    ALLOW_ARIA_ATTR = cfg.ALLOW_ARIA_ATTR !== false;
    ALLOW_DATA_ATTR = cfg.ALLOW_DATA_ATTR !== false;
    ALLOW_UNKNOWN_PROTOCOLS = cfg.ALLOW_UNKNOWN_PROTOCOLS || false;
    ALLOW_SELF_CLOSE_IN_ATTR = cfg.ALLOW_SELF_CLOSE_IN_ATTR !== false;
    SAFE_FOR_TEMPLATES = cfg.SAFE_FOR_TEMPLATES || false;
    SAFE_FOR_XML = cfg.SAFE_FOR_XML !== false;
    WHOLE_DOCUMENT = cfg.WHOLE_DOCUMENT || false;
    RETURN_DOM = cfg.RETURN_DOM || false;
    RETURN_DOM_FRAGMENT = cfg.RETURN_DOM_FRAGMENT || false;
    RETURN_TRUSTED_TYPE = cfg.RETURN_TRUSTED_TYPE || false;
    FORCE_BODY = cfg.FORCE_BODY || false;
    SANITIZE_DOM = cfg.SANITIZE_DOM !== false;
    SANITIZE_NAMED_PROPS = cfg.SANITIZE_NAMED_PROPS || false;
    KEEP_CONTENT = cfg.KEEP_CONTENT !== false;
    IN_PLACE = cfg.IN_PLACE || false;
    IS_ALLOWED_URI$1 = isRegex(cfg.ALLOWED_URI_REGEXP) ? cfg.ALLOWED_URI_REGEXP : IS_ALLOWED_URI;
    NAMESPACE = typeof cfg.NAMESPACE === "string" ? cfg.NAMESPACE : HTML_NAMESPACE;
    MATHML_TEXT_INTEGRATION_POINTS = objectHasOwnProperty(cfg, "MATHML_TEXT_INTEGRATION_POINTS") && cfg.MATHML_TEXT_INTEGRATION_POINTS && typeof cfg.MATHML_TEXT_INTEGRATION_POINTS === "object" ? clone(cfg.MATHML_TEXT_INTEGRATION_POINTS) : addToSet({}, DEFAULT_MATHML_TEXT_INTEGRATION_POINTS);
    HTML_INTEGRATION_POINTS = objectHasOwnProperty(cfg, "HTML_INTEGRATION_POINTS") && cfg.HTML_INTEGRATION_POINTS && typeof cfg.HTML_INTEGRATION_POINTS === "object" ? clone(cfg.HTML_INTEGRATION_POINTS) : addToSet({}, DEFAULT_HTML_INTEGRATION_POINTS);
    const customElementHandling = objectHasOwnProperty(cfg, "CUSTOM_ELEMENT_HANDLING") && cfg.CUSTOM_ELEMENT_HANDLING && typeof cfg.CUSTOM_ELEMENT_HANDLING === "object" ? clone(cfg.CUSTOM_ELEMENT_HANDLING) : create(null);
    CUSTOM_ELEMENT_HANDLING = create(null);
    if (objectHasOwnProperty(customElementHandling, "tagNameCheck") && isRegexOrFunction(customElementHandling.tagNameCheck)) {
      CUSTOM_ELEMENT_HANDLING.tagNameCheck = customElementHandling.tagNameCheck;
    }
    if (objectHasOwnProperty(customElementHandling, "attributeNameCheck") && isRegexOrFunction(customElementHandling.attributeNameCheck)) {
      CUSTOM_ELEMENT_HANDLING.attributeNameCheck = customElementHandling.attributeNameCheck;
    }
    if (objectHasOwnProperty(customElementHandling, "allowCustomizedBuiltInElements") && typeof customElementHandling.allowCustomizedBuiltInElements === "boolean") {
      CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements = customElementHandling.allowCustomizedBuiltInElements;
    }
    seal(CUSTOM_ELEMENT_HANDLING);
    if (SAFE_FOR_TEMPLATES) {
      ALLOW_DATA_ATTR = false;
    }
    if (RETURN_DOM_FRAGMENT) {
      RETURN_DOM = true;
    }
    if (USE_PROFILES) {
      ALLOWED_TAGS = addToSet({}, text);
      ALLOWED_ATTR = create(null);
      if (USE_PROFILES.html === true) {
        addToSet(ALLOWED_TAGS, html$1);
        addToSet(ALLOWED_ATTR, html);
      }
      if (USE_PROFILES.svg === true) {
        addToSet(ALLOWED_TAGS, svg$1);
        addToSet(ALLOWED_ATTR, svg);
        addToSet(ALLOWED_ATTR, xml);
      }
      if (USE_PROFILES.svgFilters === true) {
        addToSet(ALLOWED_TAGS, svgFilters);
        addToSet(ALLOWED_ATTR, svg);
        addToSet(ALLOWED_ATTR, xml);
      }
      if (USE_PROFILES.mathMl === true) {
        addToSet(ALLOWED_TAGS, mathMl$1);
        addToSet(ALLOWED_ATTR, mathMl);
        addToSet(ALLOWED_ATTR, xml);
      }
    }
    EXTRA_ELEMENT_HANDLING.tagCheck = null;
    EXTRA_ELEMENT_HANDLING.attributeCheck = null;
    if (objectHasOwnProperty(cfg, "ADD_TAGS")) {
      if (typeof cfg.ADD_TAGS === "function") {
        EXTRA_ELEMENT_HANDLING.tagCheck = cfg.ADD_TAGS;
      } else if (arrayIsArray(cfg.ADD_TAGS)) {
        if (ALLOWED_TAGS === DEFAULT_ALLOWED_TAGS) {
          ALLOWED_TAGS = clone(ALLOWED_TAGS);
        }
        addToSet(ALLOWED_TAGS, cfg.ADD_TAGS, transformCaseFunc);
      }
    }
    if (objectHasOwnProperty(cfg, "ADD_ATTR")) {
      if (typeof cfg.ADD_ATTR === "function") {
        EXTRA_ELEMENT_HANDLING.attributeCheck = cfg.ADD_ATTR;
      } else if (arrayIsArray(cfg.ADD_ATTR)) {
        if (ALLOWED_ATTR === DEFAULT_ALLOWED_ATTR) {
          ALLOWED_ATTR = clone(ALLOWED_ATTR);
        }
        addToSet(ALLOWED_ATTR, cfg.ADD_ATTR, transformCaseFunc);
      }
    }
    if (objectHasOwnProperty(cfg, "ADD_URI_SAFE_ATTR") && arrayIsArray(cfg.ADD_URI_SAFE_ATTR)) {
      addToSet(URI_SAFE_ATTRIBUTES, cfg.ADD_URI_SAFE_ATTR, transformCaseFunc);
    }
    if (objectHasOwnProperty(cfg, "FORBID_CONTENTS") && arrayIsArray(cfg.FORBID_CONTENTS)) {
      if (FORBID_CONTENTS === DEFAULT_FORBID_CONTENTS) {
        FORBID_CONTENTS = clone(FORBID_CONTENTS);
      }
      addToSet(FORBID_CONTENTS, cfg.FORBID_CONTENTS, transformCaseFunc);
    }
    if (objectHasOwnProperty(cfg, "ADD_FORBID_CONTENTS") && arrayIsArray(cfg.ADD_FORBID_CONTENTS)) {
      if (FORBID_CONTENTS === DEFAULT_FORBID_CONTENTS) {
        FORBID_CONTENTS = clone(FORBID_CONTENTS);
      }
      addToSet(FORBID_CONTENTS, cfg.ADD_FORBID_CONTENTS, transformCaseFunc);
    }
    if (KEEP_CONTENT) {
      ALLOWED_TAGS["#text"] = true;
    }
    if (WHOLE_DOCUMENT) {
      addToSet(ALLOWED_TAGS, ["html", "head", "body"]);
    }
    if (ALLOWED_TAGS.table) {
      addToSet(ALLOWED_TAGS, ["tbody"]);
      delete FORBID_TAGS.tbody;
    }
    if (cfg.TRUSTED_TYPES_POLICY) {
      if (typeof cfg.TRUSTED_TYPES_POLICY.createHTML !== "function") {
        throw typeErrorCreate('TRUSTED_TYPES_POLICY configuration option must provide a "createHTML" hook.');
      }
      if (typeof cfg.TRUSTED_TYPES_POLICY.createScriptURL !== "function") {
        throw typeErrorCreate('TRUSTED_TYPES_POLICY configuration option must provide a "createScriptURL" hook.');
      }
      const previousTrustedTypesPolicy = trustedTypesPolicy;
      trustedTypesPolicy = cfg.TRUSTED_TYPES_POLICY;
      try {
        emptyHTML = _createTrustedHTML("");
      } catch (error) {
        trustedTypesPolicy = previousTrustedTypesPolicy;
        throw error;
      }
    } else if (cfg.TRUSTED_TYPES_POLICY === null) {
      trustedTypesPolicy = undefined;
      emptyHTML = "";
    } else {
      if (trustedTypesPolicy === undefined) {
        trustedTypesPolicy = _getDefaultTrustedTypesPolicy();
      }
      if (trustedTypesPolicy && typeof emptyHTML === "string") {
        emptyHTML = _createTrustedHTML("");
      }
    }
    if (freeze) {
      freeze(cfg);
    }
    CONFIG = cfg;
  };
  const ALL_SVG_TAGS = addToSet({}, [...svg$1, ...svgFilters, ...svgDisallowed]);
  const ALL_MATHML_TAGS = addToSet({}, [...mathMl$1, ...mathMlDisallowed]);
  const _checkSvgNamespace = function _checkSvgNamespace(tagName, parent, parentTagName) {
    if (parent.namespaceURI === HTML_NAMESPACE) {
      return tagName === "svg";
    }
    if (parent.namespaceURI === MATHML_NAMESPACE) {
      return tagName === "svg" && (parentTagName === "annotation-xml" || MATHML_TEXT_INTEGRATION_POINTS[parentTagName]);
    }
    return Boolean(ALL_SVG_TAGS[tagName]);
  };
  const _checkMathMlNamespace = function _checkMathMlNamespace(tagName, parent, parentTagName) {
    if (parent.namespaceURI === HTML_NAMESPACE) {
      return tagName === "math";
    }
    if (parent.namespaceURI === SVG_NAMESPACE) {
      return tagName === "math" && HTML_INTEGRATION_POINTS[parentTagName];
    }
    return Boolean(ALL_MATHML_TAGS[tagName]);
  };
  const _checkHtmlNamespace = function _checkHtmlNamespace(tagName, parent, parentTagName) {
    if (parent.namespaceURI === SVG_NAMESPACE && !HTML_INTEGRATION_POINTS[parentTagName]) {
      return false;
    }
    if (parent.namespaceURI === MATHML_NAMESPACE && !MATHML_TEXT_INTEGRATION_POINTS[parentTagName]) {
      return false;
    }
    return !ALL_MATHML_TAGS[tagName] && (COMMON_SVG_AND_HTML_ELEMENTS[tagName] || !ALL_SVG_TAGS[tagName]);
  };
  const _checkValidNamespace = function _checkValidNamespace(element) {
    let parent = getParentNode(element);
    if (!parent || !parent.tagName) {
      parent = {
        namespaceURI: NAMESPACE,
        tagName: "template"
      };
    }
    const tagName = stringToLowerCase(element.tagName);
    const parentTagName = stringToLowerCase(parent.tagName);
    if (!ALLOWED_NAMESPACES[element.namespaceURI]) {
      return false;
    }
    if (element.namespaceURI === SVG_NAMESPACE) {
      return _checkSvgNamespace(tagName, parent, parentTagName);
    }
    if (element.namespaceURI === MATHML_NAMESPACE) {
      return _checkMathMlNamespace(tagName, parent, parentTagName);
    }
    if (element.namespaceURI === HTML_NAMESPACE) {
      return _checkHtmlNamespace(tagName, parent, parentTagName);
    }
    if (PARSER_MEDIA_TYPE === "application/xhtml+xml" && ALLOWED_NAMESPACES[element.namespaceURI]) {
      return true;
    }
    return false;
  };
  const _forceRemove = function _forceRemove(node) {
    arrayPush(DOMPurify.removed, {
      element: node
    });
    try {
      getParentNode(node).removeChild(node);
    } catch (_) {
      remove(node);
      if (!getParentNode(node)) {
        throw typeErrorCreate("a node selected for removal could not be detached from its tree " + "and cannot be safely returned; refusing to sanitize in place");
      }
    }
  };
  const _neutralizeRoot = function _neutralizeRoot(root) {
    const childNodes = getChildNodes(root);
    if (childNodes) {
      const snapshot = [];
      arrayForEach(childNodes, (child) => {
        arrayPush(snapshot, child);
      });
      arrayForEach(snapshot, (child) => {
        try {
          remove(child);
        } catch (_) {}
      });
    }
    const attributes = getAttributes(root);
    if (attributes) {
      for (let i = attributes.length - 1;i >= 0; --i) {
        const attribute = attributes[i];
        const name = attribute && attribute.name;
        if (typeof name === "string") {
          try {
            root.removeAttribute(name);
          } catch (_) {}
        }
      }
    }
  };
  const _removeAttribute = function _removeAttribute(name, element) {
    try {
      arrayPush(DOMPurify.removed, {
        attribute: element.getAttributeNode(name),
        from: element
      });
    } catch (_) {
      arrayPush(DOMPurify.removed, {
        attribute: null,
        from: element
      });
    }
    element.removeAttribute(name);
    if (name === "is") {
      if (RETURN_DOM || RETURN_DOM_FRAGMENT) {
        try {
          _forceRemove(element);
        } catch (_) {}
      } else {
        try {
          element.setAttribute(name, "");
        } catch (_) {}
      }
    }
  };
  const _stripDisallowedAttributes = function _stripDisallowedAttributes(element) {
    const attributes = getAttributes(element);
    if (!attributes) {
      return;
    }
    for (let i = attributes.length - 1;i >= 0; --i) {
      const attribute = attributes[i];
      const name = attribute && attribute.name;
      if (typeof name !== "string" || ALLOWED_ATTR[transformCaseFunc(name)]) {
        continue;
      }
      try {
        element.removeAttribute(name);
      } catch (_) {}
    }
  };
  const _neutralizeSubtree = function _neutralizeSubtree(root) {
    const stack = [root];
    while (stack.length > 0) {
      const node = stack.pop();
      const nodeType = getNodeType ? getNodeType(node) : node.nodeType;
      if (nodeType === NODE_TYPE.element) {
        _stripDisallowedAttributes(node);
      }
      const childNodes = getChildNodes(node);
      if (childNodes) {
        for (let i = childNodes.length - 1;i >= 0; --i) {
          stack.push(childNodes[i]);
        }
      }
    }
  };
  const _initDocument = function _initDocument(dirty) {
    let doc = null;
    let leadingWhitespace = null;
    if (FORCE_BODY) {
      dirty = "<remove></remove>" + dirty;
    } else {
      const matches = stringMatch(dirty, /^[\r\n\t ]+/);
      leadingWhitespace = matches && matches[0];
    }
    if (PARSER_MEDIA_TYPE === "application/xhtml+xml" && NAMESPACE === HTML_NAMESPACE) {
      dirty = '<html xmlns="http://www.w3.org/1999/xhtml"><head></head><body>' + dirty + "</body></html>";
    }
    const dirtyPayload = trustedTypesPolicy ? _createTrustedHTML(dirty) : dirty;
    if (NAMESPACE === HTML_NAMESPACE) {
      try {
        doc = new DOMParser().parseFromString(dirtyPayload, PARSER_MEDIA_TYPE);
      } catch (_) {}
    }
    if (!doc || !doc.documentElement) {
      doc = implementation.createDocument(NAMESPACE, "template", null);
      try {
        doc.documentElement.innerHTML = IS_EMPTY_INPUT ? emptyHTML : dirtyPayload;
      } catch (_) {}
    }
    const body = doc.body || doc.documentElement;
    if (dirty && leadingWhitespace) {
      body.insertBefore(document2.createTextNode(leadingWhitespace), body.childNodes[0] || null);
    }
    if (NAMESPACE === HTML_NAMESPACE) {
      return getElementsByTagName.call(doc, WHOLE_DOCUMENT ? "html" : "body")[0];
    }
    return WHOLE_DOCUMENT ? doc.documentElement : body;
  };
  const _createNodeIterator = function _createNodeIterator(root) {
    return createNodeIterator.call(root.ownerDocument || root, root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_TEXT | NodeFilter.SHOW_PROCESSING_INSTRUCTION | NodeFilter.SHOW_CDATA_SECTION, null);
  };
  const _stripTemplateExpressions = function _stripTemplateExpressions(value) {
    value = stringReplace(value, MUSTACHE_EXPR$1, " ");
    value = stringReplace(value, ERB_EXPR$1, " ");
    value = stringReplace(value, TMPLIT_EXPR$1, " ");
    return value;
  };
  const _scrubTemplateExpressions2 = function _scrubTemplateExpressions(node) {
    var _node$querySelectorAl;
    node.normalize();
    const walker = createNodeIterator.call(node.ownerDocument || node, node, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_CDATA_SECTION | NodeFilter.SHOW_PROCESSING_INSTRUCTION, null);
    let currentNode = walker.nextNode();
    while (currentNode) {
      currentNode.data = _stripTemplateExpressions(currentNode.data);
      currentNode = walker.nextNode();
    }
    const templates = (_node$querySelectorAl = node.querySelectorAll) === null || _node$querySelectorAl === undefined ? undefined : _node$querySelectorAl.call(node, "template");
    if (templates) {
      arrayForEach(templates, (tmpl) => {
        if (_isDocumentFragment(tmpl.content)) {
          _scrubTemplateExpressions2(tmpl.content);
        }
      });
    }
  };
  const _isClobbered = function _isClobbered(element) {
    const realTagName = getNodeName ? getNodeName(element) : null;
    if (typeof realTagName !== "string") {
      return false;
    }
    if (transformCaseFunc(realTagName) !== "form") {
      return false;
    }
    return typeof element.nodeName !== "string" || typeof element.textContent !== "string" || typeof element.removeChild !== "function" || element.attributes !== getAttributes(element) || typeof element.removeAttribute !== "function" || typeof element.setAttribute !== "function" || typeof element.namespaceURI !== "string" || typeof element.insertBefore !== "function" || typeof element.hasChildNodes !== "function" || element.nodeType !== getNodeType(element) || element.childNodes !== getChildNodes(element);
  };
  const _isDocumentFragment = function _isDocumentFragment(value) {
    if (!getNodeType || typeof value !== "object" || value === null) {
      return false;
    }
    try {
      return getNodeType(value) === NODE_TYPE.documentFragment;
    } catch (_) {
      return false;
    }
  };
  const _isNode = function _isNode(value) {
    if (!getNodeType || typeof value !== "object" || value === null) {
      return false;
    }
    try {
      return typeof getNodeType(value) === "number";
    } catch (_) {
      return false;
    }
  };
  function _executeHooks(hooks2, currentNode, data) {
    if (hooks2.length === 0) {
      return;
    }
    arrayForEach(hooks2, (hook) => {
      hook.call(DOMPurify, currentNode, data, CONFIG);
    });
  }
  const _isUnsafeNode = function _isUnsafeNode(currentNode, tagName) {
    if (SAFE_FOR_XML && currentNode.hasChildNodes() && !_isNode(currentNode.firstElementChild) && regExpTest(ELEMENT_MARKUP_PROBE, currentNode.textContent) && regExpTest(ELEMENT_MARKUP_PROBE, currentNode.innerHTML)) {
      return true;
    }
    if (SAFE_FOR_XML && currentNode.namespaceURI === HTML_NAMESPACE && tagName === "style" && _isNode(currentNode.firstElementChild)) {
      return true;
    }
    if (currentNode.nodeType === NODE_TYPE.processingInstruction) {
      return true;
    }
    if (SAFE_FOR_XML && currentNode.nodeType === NODE_TYPE.comment && regExpTest(COMMENT_MARKUP_PROBE, currentNode.data)) {
      return true;
    }
    return false;
  };
  const _sanitizeDisallowedNode = function _sanitizeDisallowedNode(currentNode, tagName) {
    if (!FORBID_TAGS[tagName] && _isBasicCustomElement(tagName)) {
      if (CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof RegExp && regExpTest(CUSTOM_ELEMENT_HANDLING.tagNameCheck, tagName)) {
        return false;
      }
      if (CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof Function && CUSTOM_ELEMENT_HANDLING.tagNameCheck(tagName)) {
        return false;
      }
    }
    if (KEEP_CONTENT && !FORBID_CONTENTS[tagName]) {
      const parentNode = getParentNode(currentNode);
      const childNodes = getChildNodes(currentNode);
      if (childNodes && parentNode) {
        const childCount = childNodes.length;
        for (let i = childCount - 1;i >= 0; --i) {
          const hoisted = IN_PLACE ? childNodes[i] : cloneNode(childNodes[i], true);
          parentNode.insertBefore(hoisted, getNextSibling(currentNode));
        }
      }
    }
    _forceRemove(currentNode);
    return true;
  };
  const _sanitizeElements = function _sanitizeElements(currentNode) {
    _executeHooks(hooks.beforeSanitizeElements, currentNode, null);
    if (_isClobbered(currentNode)) {
      _forceRemove(currentNode);
      return true;
    }
    const tagName = transformCaseFunc(getNodeName ? getNodeName(currentNode) : currentNode.nodeName);
    _executeHooks(hooks.uponSanitizeElement, currentNode, {
      tagName,
      allowedTags: ALLOWED_TAGS
    });
    if (_isUnsafeNode(currentNode, tagName)) {
      _forceRemove(currentNode);
      return true;
    }
    if (FORBID_TAGS[tagName] || !(EXTRA_ELEMENT_HANDLING.tagCheck instanceof Function && EXTRA_ELEMENT_HANDLING.tagCheck(tagName)) && !ALLOWED_TAGS[tagName]) {
      return _sanitizeDisallowedNode(currentNode, tagName);
    }
    const nt = getNodeType ? getNodeType(currentNode) : currentNode.nodeType;
    if (nt === NODE_TYPE.element && !_checkValidNamespace(currentNode)) {
      _forceRemove(currentNode);
      return true;
    }
    if ((tagName === "noscript" || tagName === "noembed" || tagName === "noframes") && regExpTest(FALLBACK_TAG_CLOSE, currentNode.innerHTML)) {
      _forceRemove(currentNode);
      return true;
    }
    if (SAFE_FOR_TEMPLATES && currentNode.nodeType === NODE_TYPE.text) {
      const content = _stripTemplateExpressions(currentNode.textContent);
      if (currentNode.textContent !== content) {
        arrayPush(DOMPurify.removed, {
          element: currentNode.cloneNode()
        });
        currentNode.textContent = content;
      }
    }
    _executeHooks(hooks.afterSanitizeElements, currentNode, null);
    return false;
  };
  const _isValidAttribute = function _isValidAttribute(lcTag, lcName, value) {
    if (FORBID_ATTR[lcName]) {
      return false;
    }
    if (SANITIZE_DOM && (lcName === "id" || lcName === "name") && ((value in document2) || (value in formElement))) {
      return false;
    }
    const nameIsPermitted = ALLOWED_ATTR[lcName] || EXTRA_ELEMENT_HANDLING.attributeCheck instanceof Function && EXTRA_ELEMENT_HANDLING.attributeCheck(lcName, lcTag);
    if (ALLOW_DATA_ATTR && regExpTest(DATA_ATTR$1, lcName))
      ;
    else if (ALLOW_ARIA_ATTR && regExpTest(ARIA_ATTR$1, lcName))
      ;
    else if (!nameIsPermitted) {
      if (_isBasicCustomElement(lcTag) && (CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof RegExp && regExpTest(CUSTOM_ELEMENT_HANDLING.tagNameCheck, lcTag) || CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof Function && CUSTOM_ELEMENT_HANDLING.tagNameCheck(lcTag)) && (CUSTOM_ELEMENT_HANDLING.attributeNameCheck instanceof RegExp && regExpTest(CUSTOM_ELEMENT_HANDLING.attributeNameCheck, lcName) || CUSTOM_ELEMENT_HANDLING.attributeNameCheck instanceof Function && CUSTOM_ELEMENT_HANDLING.attributeNameCheck(lcName, lcTag)) || lcName === "is" && CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements && (CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof RegExp && regExpTest(CUSTOM_ELEMENT_HANDLING.tagNameCheck, value) || CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof Function && CUSTOM_ELEMENT_HANDLING.tagNameCheck(value)))
        ;
      else {
        return false;
      }
    } else if (URI_SAFE_ATTRIBUTES[lcName])
      ;
    else if (regExpTest(IS_ALLOWED_URI$1, stringReplace(value, ATTR_WHITESPACE$1, "")))
      ;
    else if ((lcName === "src" || lcName === "xlink:href" || lcName === "href") && lcTag !== "script" && stringIndexOf(value, "data:") === 0 && DATA_URI_TAGS[lcTag])
      ;
    else if (ALLOW_UNKNOWN_PROTOCOLS && !regExpTest(IS_SCRIPT_OR_DATA$1, stringReplace(value, ATTR_WHITESPACE$1, "")))
      ;
    else if (value) {
      return false;
    } else
      ;
    return true;
  };
  const RESERVED_CUSTOM_ELEMENT_NAMES = addToSet({}, ["annotation-xml", "color-profile", "font-face", "font-face-format", "font-face-name", "font-face-src", "font-face-uri", "missing-glyph"]);
  const _isBasicCustomElement = function _isBasicCustomElement(tagName) {
    return !RESERVED_CUSTOM_ELEMENT_NAMES[stringToLowerCase(tagName)] && regExpTest(CUSTOM_ELEMENT$1, tagName);
  };
  const _applyTrustedTypesToAttribute = function _applyTrustedTypesToAttribute(lcTag, lcName, namespaceURI, value) {
    if (trustedTypesPolicy && typeof trustedTypes === "object" && typeof trustedTypes.getAttributeType === "function" && !namespaceURI) {
      switch (trustedTypes.getAttributeType(lcTag, lcName)) {
        case "TrustedHTML": {
          return _createTrustedHTML(value);
        }
        case "TrustedScriptURL": {
          return _createTrustedScriptURL(value);
        }
      }
    }
    return value;
  };
  const _setAttributeValue = function _setAttributeValue(currentNode, name, namespaceURI, value) {
    try {
      if (namespaceURI) {
        currentNode.setAttributeNS(namespaceURI, name, value);
      } else {
        currentNode.setAttribute(name, value);
      }
      if (_isClobbered(currentNode)) {
        _forceRemove(currentNode);
      } else {
        arrayPop(DOMPurify.removed);
      }
    } catch (_) {
      _removeAttribute(name, currentNode);
    }
  };
  const _sanitizeAttributes = function _sanitizeAttributes(currentNode) {
    _executeHooks(hooks.beforeSanitizeAttributes, currentNode, null);
    const attributes = currentNode.attributes;
    if (!attributes || _isClobbered(currentNode)) {
      return;
    }
    const hookEvent = {
      attrName: "",
      attrValue: "",
      keepAttr: true,
      allowedAttributes: ALLOWED_ATTR,
      forceKeepAttr: undefined
    };
    let l = attributes.length;
    const lcTag = transformCaseFunc(currentNode.nodeName);
    while (l--) {
      const attr = attributes[l];
      const { name, namespaceURI, value: attrValue } = attr;
      const lcName = transformCaseFunc(name);
      const initValue = attrValue;
      let value = name === "value" ? initValue : stringTrim(initValue);
      hookEvent.attrName = lcName;
      hookEvent.attrValue = value;
      hookEvent.keepAttr = true;
      hookEvent.forceKeepAttr = undefined;
      _executeHooks(hooks.uponSanitizeAttribute, currentNode, hookEvent);
      value = hookEvent.attrValue;
      if (SANITIZE_NAMED_PROPS && (lcName === "id" || lcName === "name") && stringIndexOf(value, SANITIZE_NAMED_PROPS_PREFIX) !== 0) {
        _removeAttribute(name, currentNode);
        value = SANITIZE_NAMED_PROPS_PREFIX + value;
      }
      if (SAFE_FOR_XML && regExpTest(/((--!?|])>)|<\/(style|script|title|xmp|textarea|noscript|iframe|noembed|noframes)/i, value)) {
        _removeAttribute(name, currentNode);
        continue;
      }
      if (lcName === "attributename" && stringMatch(value, "href")) {
        _removeAttribute(name, currentNode);
        continue;
      }
      if (hookEvent.forceKeepAttr) {
        continue;
      }
      if (!hookEvent.keepAttr) {
        _removeAttribute(name, currentNode);
        continue;
      }
      if (!ALLOW_SELF_CLOSE_IN_ATTR && regExpTest(SELF_CLOSING_TAG, value)) {
        _removeAttribute(name, currentNode);
        continue;
      }
      if (SAFE_FOR_TEMPLATES) {
        value = _stripTemplateExpressions(value);
      }
      if (!_isValidAttribute(lcTag, lcName, value)) {
        _removeAttribute(name, currentNode);
        continue;
      }
      value = _applyTrustedTypesToAttribute(lcTag, lcName, namespaceURI, value);
      if (value !== initValue) {
        _setAttributeValue(currentNode, name, namespaceURI, value);
      }
    }
    _executeHooks(hooks.afterSanitizeAttributes, currentNode, null);
  };
  const _sanitizeShadowDOM2 = function _sanitizeShadowDOM(fragment) {
    let shadowNode = null;
    const shadowIterator = _createNodeIterator(fragment);
    _executeHooks(hooks.beforeSanitizeShadowDOM, fragment, null);
    while (shadowNode = shadowIterator.nextNode()) {
      _executeHooks(hooks.uponSanitizeShadowNode, shadowNode, null);
      _sanitizeElements(shadowNode);
      _sanitizeAttributes(shadowNode);
      if (_isDocumentFragment(shadowNode.content)) {
        _sanitizeShadowDOM2(shadowNode.content);
      }
      const shadowNodeType = getNodeType ? getNodeType(shadowNode) : shadowNode.nodeType;
      if (shadowNodeType === NODE_TYPE.element) {
        const innerSr = getShadowRoot(shadowNode);
        if (_isDocumentFragment(innerSr)) {
          _sanitizeAttachedShadowRoots(innerSr);
          _sanitizeShadowDOM2(innerSr);
        }
      }
    }
    _executeHooks(hooks.afterSanitizeShadowDOM, fragment, null);
  };
  const _sanitizeAttachedShadowRoots = function _sanitizeAttachedShadowRoots(root) {
    const stack = [{
      node: root,
      shadow: null
    }];
    while (stack.length > 0) {
      const item = stack.pop();
      if (item.shadow) {
        _sanitizeShadowDOM2(item.shadow);
        continue;
      }
      const node = item.node;
      const nodeType = getNodeType ? getNodeType(node) : node.nodeType;
      const isElement = nodeType === NODE_TYPE.element;
      const childNodes = getChildNodes(node);
      if (childNodes) {
        for (let i = childNodes.length - 1;i >= 0; --i) {
          stack.push({
            node: childNodes[i],
            shadow: null
          });
        }
      }
      if (isElement) {
        const rootName = getNodeName ? getNodeName(node) : null;
        if (typeof rootName === "string" && transformCaseFunc(rootName) === "template") {
          const content = node.content;
          if (_isDocumentFragment(content)) {
            stack.push({
              node: content,
              shadow: null
            });
          }
        }
      }
      if (isElement) {
        const sr = getShadowRoot(node);
        if (_isDocumentFragment(sr)) {
          stack.push({
            node: null,
            shadow: sr
          }, {
            node: sr,
            shadow: null
          });
        }
      }
    }
  };
  DOMPurify.sanitize = function(dirty) {
    let cfg = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
    let body = null;
    let importedNode = null;
    let currentNode = null;
    let returnNode = null;
    IS_EMPTY_INPUT = !dirty;
    if (IS_EMPTY_INPUT) {
      dirty = "<!-->";
    }
    if (typeof dirty !== "string" && !_isNode(dirty)) {
      dirty = stringifyValue(dirty);
      if (typeof dirty !== "string") {
        throw typeErrorCreate("dirty is not a string, aborting");
      }
    }
    if (!DOMPurify.isSupported) {
      return dirty;
    }
    if (SET_CONFIG) {
      ALLOWED_TAGS = SET_CONFIG_ALLOWED_TAGS;
      ALLOWED_ATTR = SET_CONFIG_ALLOWED_ATTR;
    } else {
      _parseConfig(cfg);
    }
    if (hooks.uponSanitizeElement.length > 0 || hooks.uponSanitizeAttribute.length > 0) {
      ALLOWED_TAGS = clone(ALLOWED_TAGS);
    }
    if (hooks.uponSanitizeAttribute.length > 0) {
      ALLOWED_ATTR = clone(ALLOWED_ATTR);
    }
    DOMPurify.removed = [];
    const inPlace = IN_PLACE && typeof dirty !== "string" && _isNode(dirty);
    if (inPlace) {
      const nn = getNodeName ? getNodeName(dirty) : dirty.nodeName;
      if (typeof nn === "string") {
        const tagName = transformCaseFunc(nn);
        if (!ALLOWED_TAGS[tagName] || FORBID_TAGS[tagName]) {
          throw typeErrorCreate("root node is forbidden and cannot be sanitized in-place");
        }
      }
      if (_isClobbered(dirty)) {
        throw typeErrorCreate("root node is clobbered and cannot be sanitized in-place");
      }
      try {
        _sanitizeAttachedShadowRoots(dirty);
      } catch (error) {
        _neutralizeRoot(dirty);
        throw error;
      }
    } else if (_isNode(dirty)) {
      body = _initDocument("<!---->");
      importedNode = body.ownerDocument.importNode(dirty, true);
      if (importedNode.nodeType === NODE_TYPE.element && importedNode.nodeName === "BODY") {
        body = importedNode;
      } else if (importedNode.nodeName === "HTML") {
        body = importedNode;
      } else {
        body.appendChild(importedNode);
      }
      _sanitizeAttachedShadowRoots(importedNode);
    } else {
      if (!RETURN_DOM && !SAFE_FOR_TEMPLATES && !WHOLE_DOCUMENT && dirty.indexOf("<") === -1) {
        return trustedTypesPolicy && RETURN_TRUSTED_TYPE ? _createTrustedHTML(dirty) : dirty;
      }
      body = _initDocument(dirty);
      if (!body) {
        return RETURN_DOM ? null : RETURN_TRUSTED_TYPE ? emptyHTML : "";
      }
    }
    if (body && FORCE_BODY) {
      _forceRemove(body.firstChild);
    }
    const nodeIterator = _createNodeIterator(inPlace ? dirty : body);
    try {
      while (currentNode = nodeIterator.nextNode()) {
        _sanitizeElements(currentNode);
        _sanitizeAttributes(currentNode);
        if (_isDocumentFragment(currentNode.content)) {
          _sanitizeShadowDOM2(currentNode.content);
        }
      }
    } catch (error) {
      if (inPlace) {
        _neutralizeRoot(dirty);
      }
      throw error;
    }
    if (inPlace) {
      arrayForEach(DOMPurify.removed, (entry) => {
        if (entry.element) {
          _neutralizeSubtree(entry.element);
        }
      });
      if (SAFE_FOR_TEMPLATES) {
        _scrubTemplateExpressions2(dirty);
      }
      return dirty;
    }
    if (RETURN_DOM) {
      if (SAFE_FOR_TEMPLATES) {
        _scrubTemplateExpressions2(body);
      }
      if (RETURN_DOM_FRAGMENT) {
        returnNode = createDocumentFragment.call(body.ownerDocument);
        while (body.firstChild) {
          returnNode.appendChild(body.firstChild);
        }
      } else {
        returnNode = body;
      }
      if (ALLOWED_ATTR.shadowroot || ALLOWED_ATTR.shadowrootmode) {
        returnNode = importNode.call(originalDocument, returnNode, true);
      }
      return returnNode;
    }
    let serializedHTML = WHOLE_DOCUMENT ? body.outerHTML : body.innerHTML;
    if (WHOLE_DOCUMENT && ALLOWED_TAGS["!doctype"] && body.ownerDocument && body.ownerDocument.doctype && body.ownerDocument.doctype.name && regExpTest(DOCTYPE_NAME, body.ownerDocument.doctype.name)) {
      serializedHTML = "<!DOCTYPE " + body.ownerDocument.doctype.name + `>
` + serializedHTML;
    }
    if (SAFE_FOR_TEMPLATES) {
      serializedHTML = _stripTemplateExpressions(serializedHTML);
    }
    return trustedTypesPolicy && RETURN_TRUSTED_TYPE ? _createTrustedHTML(serializedHTML) : serializedHTML;
  };
  DOMPurify.setConfig = function() {
    let cfg = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};
    _parseConfig(cfg);
    SET_CONFIG = true;
    SET_CONFIG_ALLOWED_TAGS = ALLOWED_TAGS;
    SET_CONFIG_ALLOWED_ATTR = ALLOWED_ATTR;
  };
  DOMPurify.clearConfig = function() {
    CONFIG = null;
    SET_CONFIG = false;
    SET_CONFIG_ALLOWED_TAGS = null;
    SET_CONFIG_ALLOWED_ATTR = null;
    trustedTypesPolicy = defaultTrustedTypesPolicy;
    emptyHTML = "";
  };
  DOMPurify.isValidAttribute = function(tag, attr, value) {
    if (!CONFIG) {
      _parseConfig({});
    }
    const lcTag = transformCaseFunc(tag);
    const lcName = transformCaseFunc(attr);
    return _isValidAttribute(lcTag, lcName, value);
  };
  DOMPurify.addHook = function(entryPoint, hookFunction) {
    if (typeof hookFunction !== "function") {
      return;
    }
    if (!objectHasOwnProperty(hooks, entryPoint)) {
      return;
    }
    arrayPush(hooks[entryPoint], hookFunction);
  };
  DOMPurify.removeHook = function(entryPoint, hookFunction) {
    if (!objectHasOwnProperty(hooks, entryPoint)) {
      return;
    }
    if (hookFunction !== undefined) {
      const index = arrayLastIndexOf(hooks[entryPoint], hookFunction);
      return index === -1 ? undefined : arraySplice(hooks[entryPoint], index, 1)[0];
    }
    return arrayPop(hooks[entryPoint]);
  };
  DOMPurify.removeHooks = function(entryPoint) {
    if (!objectHasOwnProperty(hooks, entryPoint)) {
      return;
    }
    hooks[entryPoint] = [];
  };
  DOMPurify.removeAllHooks = function() {
    hooks = _createHooksMap();
  };
  return DOMPurify;
}
var purify = createDOMPurify();

// src/ui/components/css-workshop/sanitize.ts
function sanitizeWorkshopCss(raw) {
  if (!raw)
    return "";
  let s = raw;
  s = s.replace(/@import\b[^;]+;?/gi, "");
  s = s.replace(/@font-face\s*\{[\s\S]*?\}/gi, "");
  s = s.replace(/expression\s*\(/gi, "/*blocked*/(");
  s = s.replace(/behavior\s*:/gi, "/*blocked*/:");
  s = s.replace(/-moz-binding\s*:/gi, "/*blocked*/:");
  s = s.replace(/url\s*\(\s*['"]?\s*(?!data:)[^)]+\)/gi, "url(about:blank)");
  return s;
}

// src/ui/components/css-workshop/preview.ts
var BASE_MOCK_CSS = `
html, body {
  margin: 0;
  padding: 0;
  max-width: 100%;
  overflow: auto;
  font-family: system-ui, sans-serif;
  background: #0c0b10;
  color: #e8e4ef;
}
.page, .chub-root, .risu-stage, .jai-page {
  min-height: 100%;
  padding: 12px;
  box-sizing: border-box;
}
.card, .chub-bubble, .risu-panel, .jai-profile-card, .jai-bot-card {
  background: #1a1820;
  border: 1px solid #2e2a38;
  border-radius: 8px;
  padding: 12px;
}
.avatar, .chub-avatar, .jai-pfp, .jai-bot-img {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #3a3548;
  flex-shrink: 0;
}
.card-header, .chub-message {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  margin-bottom: 10px;
}
.name, .chub-name, .jai-username, .jai-bot-name, .risu-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
}
.body, .chub-text, .jai-bot-preview, .risu-body {
  margin: 0.35rem 0 0;
  font-size: 0.9rem;
  color: #c9c2d6;
}
.tag, .jai-bot-tag, .risu-stat {
  display: inline-block;
  margin: 4px 4px 0 0;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid #3a3545;
  font-size: 0.75rem;
}
.chub-user .chub-bubble { margin-left: auto; max-width: 85%; }
.jai-follow {
  margin-top: 8px;
  padding: 6px 12px;
  border: 1px solid #5b4d7a;
  background: #2a2440;
  color: #efeaf8;
  border-radius: 6px;
}
`.trim();
var FORBID_TAGS = [
  "script",
  "iframe",
  "object",
  "embed",
  "form",
  "input",
  "button",
  "textarea",
  "select",
  "link",
  "meta",
  "base",
  "frame",
  "frameset"
];
function buildCssWorkshopSrcDoc(mockHtml, authorCss) {
  const cleanHtml = purify.sanitize(mockHtml || "", {
    FORBID_TAGS,
    ALLOW_DATA_ATTR: false,
    ADD_ATTR: ["target", "type", "aria-hidden"]
  });
  const cleanCss = sanitizeWorkshopCss(authorCss);
  const csp = "default-src 'none'; img-src data: blob: https: http:; media-src data: blob:; " + "style-src 'unsafe-inline'; script-src 'none'; font-src 'none'; connect-src 'none'; " + "frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
  return `<!doctype html><html><head>` + `<meta charset="utf-8"/>` + `<meta http-equiv="Content-Security-Policy" content="${csp}"/>` + `<style>${BASE_MOCK_CSS}</style>` + `<style>${cleanCss}</style>` + `</head><body>${cleanHtml}</body></html>`;
}

// src/ui/components/css-workshop/recipes/soft-card/index.ts
var recipe = {
  id: "soft-card",
  order: 10,
  title: "Soft card",
  blurb: "Rounded panel, soft shadow, readable body type.",
  packs: ["universal", "chub-card"],
  css: `/* soft card */
.card, .chub-bubble {
  background: #1a1820;
  color: #e8e4ef;
  border-radius: 12px;
  padding: 12px 14px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  border: 1px solid #2e2a38;
}

.name, .chub-name {
  color: #f5f0ff;
  font-weight: 700;
  font-size: 1.05rem;
}

.body, .chub-text {
  color: #c9c2d6;
  font-size: 0.92rem;
  line-height: 1.45;
}`
};
var soft_card_default = recipe;

// src/ui/components/css-workshop/recipes/dark-glass/index.ts
var recipe2 = {
  id: "dark-glass",
  order: 20,
  title: "Dark glass",
  blurb: "Frosted dark panel. Hosts may ignore backdrop-filter.",
  packs: ["universal", "chub-card", "risu-backdrop", "janitor-profile"],
  css: `/* dark glass */
.page, .chub-root, .risu-stage, .jai-page {
  background: radial-gradient(ellipse at top, #2a2040 0%, #0c0a12 70%);
}

.card, .chub-bubble, .risu-panel, .jai-profile-card, .jai-bot-card {
  background: rgba(18, 16, 28, 0.72);
  color: #efeaf8;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  padding: 14px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(10px);
}`
};
var dark_glass_default = recipe2;

// src/ui/components/css-workshop/recipes/no-gradient/index.ts
var recipe3 = {
  id: "no-gradient",
  order: 30,
  title: "Flat solids",
  blurb: "Kill fancy fills. Solid backgrounds only.",
  packs: ["universal", "janitor-profile", "chub-card"],
  css: `/* flat solids */
.card, .jai-profile-card, .jai-bot-card, .chub-bubble {
  background: #141218 !important;
  background-image: none !important;
  border-radius: 8px;
  border: 1px solid #3a3545;
  color: #ece8f4;
}`
};
var no_gradient_default = recipe3;

// src/ui/components/css-workshop/recipes/neon-outline/index.ts
var recipe4 = {
  id: "neon-outline",
  order: 40,
  title: "Neon outline",
  blurb: "Hot border glow on cards and tags.",
  packs: ["universal", "chub-card", "janitor-profile"],
  css: `/* neon outline */
.card, .chub-bubble, .jai-bot-card {
  border: 2px solid #c084fc;
  box-shadow: 0 0 0 1px rgba(192, 132, 252, 0.25), 0 0 18px rgba(192, 132, 252, 0.35);
  background: #100e16;
  color: #f3e8ff;
}

.tag, .jai-bot-tag {
  border: 1px solid #a78bfa;
  color: #e9d5ff;
  border-radius: 999px;
  padding: 2px 8px;
  background: rgba(88, 28, 135, 0.35);
}`
};
var neon_outline_default = recipe4;

// src/ui/components/css-workshop/recipes/readable-type/index.ts
var recipe5 = {
  id: "readable-type",
  order: 50,
  title: "Readable type",
  blurb: "Clear sizes, contrast, and line height. Aesthetic second.",
  packs: ["universal", "chub-card", "risu-backdrop", "janitor-profile"],
  css: `/* readable type */
.name, .chub-name, .jai-username, .jai-bot-name, .risu-title {
  font-family: Georgia, "Times New Roman", serif;
  font-size: 1.15rem;
  font-weight: 700;
  color: #faf7ff;
  letter-spacing: 0.01em;
}

.body, .chub-text, .jai-bot-preview, .risu-body {
  font-family: system-ui, -apple-system, Segoe UI, sans-serif;
  font-size: 0.95rem;
  line-height: 1.55;
  color: #d6d0e2;
}`
};
var readable_type_default = recipe5;

// src/ui/components/css-workshop/recipes/registry.ts
var PACKS = [
  soft_card_default,
  dark_glass_default,
  no_gradient_default,
  neon_outline_default,
  readable_type_default
];
function listCssRecipes(packId) {
  const all = [...PACKS].sort((a, b) => (a.order ?? 100) - (b.order ?? 100) || a.id.localeCompare(b.id));
  if (!packId)
    return all;
  return all.filter((r) => !r.packs || r.packs.length === 0 || r.packs.includes(packId));
}

// src/ui/components/css-workshop/starters.tsx
import { jsxDEV as jsxDEV11 } from "react/jsx-dev-runtime";
function CssStarters({ packId, packBlurb, onApply }) {
  const recipes = listCssRecipes(packId);
  return /* @__PURE__ */ jsxDEV11("div", {
    className: styles_module_default6.assist,
    "data-tour": "css-starters",
    children: [
      /* @__PURE__ */ jsxDEV11("p", {
        className: styles_module_default6.hint,
        children: [
          "Drop a starter into your sheet, then tune it in Assist or Source. ",
          packBlurb
        ]
      }, undefined, true, undefined, this),
      recipes.map((r) => /* @__PURE__ */ jsxDEV11("div", {
        className: styles_module_default6.recipe,
        children: [
          /* @__PURE__ */ jsxDEV11("div", {
            className: styles_module_default6.recipeHead,
            children: [
              /* @__PURE__ */ jsxDEV11("span", {
                className: styles_module_default6.recipeTitle,
                children: r.title
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV11("button", {
                type: "button",
                className: styles_module_default6.useBtn,
                onClick: () => onApply(r.css),
                children: "use this"
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ jsxDEV11("p", {
            className: styles_module_default6.blurb,
            children: r.blurb
          }, undefined, false, undefined, this)
        ]
      }, r.id, true, undefined, this))
    ]
  }, undefined, true, undefined, this);
}

// src/ui/components/css-workshop/targets/universal.ts
var pack = {
  id: "universal",
  order: 10,
  title: "Universal",
  blurb: "Generic card pieces. Plain CSS, any host.",
  mockHtml: `
<div class="page">
  <article class="card">
    <header class="card-header">
      <div class="avatar" aria-hidden="true"></div>
      <div class="card-meta">
        <h1 class="name">Sample Name</h1>
        <p class="subtitle">subtitle / creator</p>
      </div>
    </header>
    <p class="body">Body text. Style me with the knobs or write CSS below.</p>
    <footer class="card-footer"><span class="tag">tag</span><span class="tag">tag</span></footer>
  </article>
</div>`.trim(),
  targets: [
    { id: "page", label: "Page", selector: ".page", help: "Outer page shell" },
    { id: "card", label: "Card", selector: ".card", help: "Main card surface" },
    { id: "header", label: "Header", selector: ".card-header" },
    { id: "avatar", label: "Avatar", selector: ".avatar" },
    { id: "name", label: "Name", selector: ".name" },
    { id: "body", label: "Body text", selector: ".body" },
    { id: "tag", label: "Tags", selector: ".tag" },
    { id: "free", label: "Free selector", selector: "", help: "Type any selector in Assist" }
  ]
};
var universal_default = pack;

// src/ui/components/css-workshop/targets/chub-card.ts
var pack2 = {
  id: "chub-card",
  order: 20,
  title: "Chub card",
  blurb: "Mock chat card chrome for Chub custom_css. Real site classes may differ.",
  mockHtml: `
<div class="chub-root">
  <div class="chub-chat">
    <div class="chub-message chub-char">
      <div class="chub-avatar"></div>
      <div class="chub-bubble">
        <div class="chub-name">Character</div>
        <div class="chub-text">Hello. This is a sealed preview of your card CSS.</div>
      </div>
    </div>
    <div class="chub-message chub-user">
      <div class="chub-bubble">
        <div class="chub-name">You</div>
        <div class="chub-text">User message styling goes here.</div>
      </div>
    </div>
  </div>
</div>`.trim(),
  targets: [
    { id: "root", label: "Chat root", selector: ".chub-root" },
    { id: "chat", label: "Chat area", selector: ".chub-chat" },
    { id: "msg", label: "All messages", selector: ".chub-message" },
    { id: "char", label: "Character row", selector: ".chub-char" },
    { id: "user", label: "User row", selector: ".chub-user" },
    { id: "bubble", label: "Bubble", selector: ".chub-bubble" },
    { id: "name", label: "Name", selector: ".chub-name" },
    { id: "text", label: "Message text", selector: ".chub-text" },
    { id: "avatar", label: "Avatar", selector: ".chub-avatar" },
    { id: "free", label: "Free selector", selector: "" }
  ]
};
var chub_card_default = pack2;

// src/ui/components/css-workshop/targets/risu-backdrop.ts
var pack3 = {
  id: "risu-backdrop",
  order: 30,
  title: "Risu backdrop",
  blurb: "Game-screen / backdrop shell for Risu backgroundCSS.",
  mockHtml: `
<div class="risu-stage">
  <div class="risu-panel">
    <h1 class="risu-title">Scene title</h1>
    <p class="risu-body">Backdrop HTML + CSS live here in chat.</p>
    <div class="risu-hud"><span class="risu-stat">HP 12</span><span class="risu-stat">Gold 3</span></div>
  </div>
</div>`.trim(),
  targets: [
    { id: "stage", label: "Stage", selector: ".risu-stage" },
    { id: "panel", label: "Panel", selector: ".risu-panel" },
    { id: "title", label: "Title", selector: ".risu-title" },
    { id: "body", label: "Body", selector: ".risu-body" },
    { id: "hud", label: "HUD", selector: ".risu-hud" },
    { id: "stat", label: "Stat chip", selector: ".risu-stat" },
    { id: "free", label: "Free selector", selector: "" }
  ]
};
var risu_backdrop_default = pack3;

// src/ui/components/css-workshop/targets/janitor-profile.ts
var pack4 = {
  id: "janitor-profile",
  order: 40,
  title: "Janitor profile",
  blurb: "Profile cosmetics (not cards). Live JAI class ids change; use Inspect if a selector fails.",
  mockHtml: `
<div class="jai-page">
  <aside class="jai-profile-card">
    <div class="jai-pfp"></div>
    <div class="jai-username">Creator</div>
    <div class="jai-followers">1.2k followers</div>
    <button type="button" class="jai-follow">Follow</button>
  </aside>
  <section class="jai-bots">
    <article class="jai-bot-card">
      <div class="jai-bot-img"></div>
      <div class="jai-bot-name">Bot name</div>
      <div class="jai-bot-preview">Bio preview text…</div>
      <span class="jai-bot-tag">tag</span>
    </article>
  </section>
</div>`.trim(),
  targets: [
    { id: "page", label: "Page", selector: ".jai-page" },
    { id: "profile", label: "Profile card", selector: ".jai-profile-card" },
    { id: "pfp", label: "Profile pic", selector: ".jai-pfp" },
    { id: "username", label: "Username", selector: ".jai-username" },
    { id: "follow", label: "Follow button", selector: ".jai-follow" },
    { id: "bot", label: "Bot card", selector: ".jai-bot-card" },
    { id: "botname", label: "Bot name", selector: ".jai-bot-name" },
    { id: "preview", label: "Bot preview", selector: ".jai-bot-preview" },
    { id: "tag", label: "Bot tag", selector: ".jai-bot-tag" },
    { id: "free", label: "Free selector", selector: "", help: "Paste a live .css-* id from Inspect" }
  ]
};
var janitor_profile_default = pack4;

// src/ui/components/css-workshop/targets/registry.ts
var PACKS2 = [
  universal_default,
  chub_card_default,
  risu_backdrop_default,
  janitor_profile_default
];
function listTargetPacks() {
  return [...PACKS2].sort((a, b) => (a.order ?? 100) - (b.order ?? 100) || a.id.localeCompare(b.id));
}
function targetPackById(id) {
  return PACKS2.find((p) => p.id === id);
}

// src/ui/components/css-workshop/index.tsx
import { jsxDEV as jsxDEV12 } from "react/jsx-dev-runtime";
var DEFAULT_NOTE = "Sealed preview only. Hoplight never applies this CSS to the app. Export keeps your full source for the host site.";
var SIMPLE_TABS = [
  ["starters", "Starters"],
  ["assist", "Assist"],
  ["source", "Source"]
];
function CssWorkshop({
  value,
  onChange,
  defaultPackId = "universal",
  onPackChange,
  note = DEFAULT_NOTE,
  mode: modeProp,
  onModeChange,
  initialMode = "simple",
  simpleTab: simpleTabProp,
  onSimpleTabChange,
  initialSimpleTab = "assist"
}) {
  const modeControlled = modeProp !== undefined;
  const [modeInner, setModeInner] = useState5(initialMode);
  const mode = modeControlled ? modeProp : modeInner;
  const setMode = (next) => {
    if (!modeControlled)
      setModeInner(next);
    onModeChange?.(next);
  };
  const tabControlled = simpleTabProp !== undefined;
  const [tabInner, setTabInner] = useState5(initialSimpleTab);
  const simpleTab = tabControlled ? simpleTabProp : tabInner;
  const setSimpleTab = (next) => {
    if (!tabControlled)
      setTabInner(next);
    onSimpleTabChange?.(next);
  };
  const [packId, setPackId] = useState5(defaultPackId);
  const [ruleId, setRuleId] = useState5(null);
  const [undoStack, setUndoStack] = useState5([]);
  const [importMsg, setImportMsg] = useState5("");
  const fileRef = useRef4(null);
  useEffect3(() => {
    setPackId(defaultPackId);
  }, [defaultPackId]);
  const pack5 = targetPackById(packId) ?? listTargetPacks()[0];
  const doc = useMemo(() => parseCss(value), [value]);
  const selected = ruleId ? doc.rules.find((r) => r.id === ruleId) : mode === "simple" && simpleTab === "assist" ? doc.rules[0] : undefined;
  const srcDoc = useMemo(() => buildCssWorkshopSrcDoc(pack5.mockHtml, value), [pack5.mockHtml, value]);
  const pushUndo = (prev) => {
    setUndoStack((s) => [...s.slice(-19), prev]);
  };
  const commit = (next) => {
    pushUndo(value);
    onChange(next);
  };
  const commitDoc = (nextDoc) => {
    commit(emitCss(nextDoc));
  };
  const changePack = (id) => {
    setPackId(id);
    onPackChange?.(id);
  };
  const applyRecipe = (css) => {
    commit(mergeCss(value, css));
    setSimpleTab("source");
    setMode("simple");
  };
  const undo = () => {
    const prev = undoStack[undoStack.length - 1];
    if (prev === undefined)
      return;
    setUndoStack((s) => s.slice(0, -1));
    onChange(prev);
  };
  const addRule = (selector) => {
    const sel = selector.trim() || ".card";
    const rule = makeRule(sel, [{ property: "color", value: "#e8e4ef" }], "new rule");
    commitDoc(appendRule(doc, rule));
    setRuleId(rule.id);
    setSimpleTab("assist");
    setMode("simple");
  };
  const onRuleChange = (rule) => {
    commitDoc(replaceRule(doc, rule));
    setRuleId(rule.id);
  };
  const applyChip = (insert) => {
    if (!selected) {
      commit(mergeCss(value, `.card {
  ${insert}
}`));
      return;
    }
    const m = insert.match(/^([a-z-]+)\s*:\s*(.+);?\s*$/i);
    if (!m) {
      commit(`${value.trim()}
${insert}`);
      return;
    }
    let val = m[2].trim();
    let important = false;
    if (/\s*!important\s*$/i.test(val)) {
      important = true;
      val = val.replace(/\s*!important\s*$/i, "").trim();
    }
    onRuleChange(setProp(selected, m[1], val, important));
  };
  const importFile = async (file) => {
    if (!looksLikeCssFile(file.name) && file.type && !file.type.includes("css") && !file.type.includes("text")) {
      setImportMsg("pick a .css (or plain text) file");
      return;
    }
    try {
      const text2 = await readCssFile(file);
      const sum = summarizeImport(text2);
      pushUndo(value);
      onChange(text2);
      setRuleId(null);
      setMode("advanced");
      const free = sum.freeform ? " · freeform kept" : "";
      setImportMsg(`imported ${file.name} · ${sum.rules} rule${sum.rules === 1 ? "" : "s"}${free}`);
    } catch {
      setImportMsg("could not read that file");
    }
  };
  const onFileChange = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f)
      importFile(f);
  };
  return /* @__PURE__ */ jsxDEV12("div", {
    className: styles_module_default6.root,
    children: [
      /* @__PURE__ */ jsxDEV12("div", {
        className: styles_module_default6.banner,
        children: [
          /* @__PURE__ */ jsxDEV12("strong", {
            children: "CSS workshop."
          }, undefined, false, undefined, this),
          " ",
          note,
          " Source is always real CSS you can edit."
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV12("div", {
        className: styles_module_default6.packRow,
        "data-tour": "css-targets",
        children: [
          /* @__PURE__ */ jsxDEV12("span", {
            className: styles_module_default6.packLabel,
            children: "Targets"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV12("select", {
            className: styles_module_default6.sel,
            value: pack5.id,
            onChange: (e) => changePack(e.target.value),
            "aria-label": "Target pack",
            children: listTargetPacks().map((p) => /* @__PURE__ */ jsxDEV12("option", {
              value: p.id,
              children: p.title
            }, p.id, false, undefined, this))
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV12("span", {
            className: styles_module_default6.packLabel,
            children: "Mode"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV12("div", {
            className: styles_module_default6.modeToggle,
            role: "group",
            "aria-label": "Editor mode",
            "data-tour": "css-mode",
            children: [
              /* @__PURE__ */ jsxDEV12("button", {
                type: "button",
                className: mode === "simple" ? `${styles_module_default6.modeBtn} ${styles_module_default6.modeOn}` : styles_module_default6.modeBtn,
                "aria-pressed": mode === "simple",
                onClick: () => setMode("simple"),
                children: "Simple"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV12("button", {
                type: "button",
                className: mode === "advanced" ? `${styles_module_default6.modeBtn} ${styles_module_default6.modeOn}` : styles_module_default6.modeBtn,
                "aria-pressed": mode === "advanced",
                onClick: () => setMode("advanced"),
                children: "Advanced"
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ jsxDEV12("button", {
            type: "button",
            className: styles_module_default6.mini,
            onClick: () => fileRef.current?.click(),
            "data-tour": "css-import",
            children: "import .css"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV12("input", {
            ref: fileRef,
            type: "file",
            className: styles_module_default6.fileInput,
            accept: CSS_FILE_ACCEPT,
            "aria-label": "Import CSS file",
            onChange: onFileChange
          }, undefined, false, undefined, this),
          undoStack.length > 0 && /* @__PURE__ */ jsxDEV12("button", {
            type: "button",
            className: styles_module_default6.mini,
            onClick: undo,
            children: "undo"
          }, undefined, false, undefined, this),
          importMsg ? /* @__PURE__ */ jsxDEV12("span", {
            className: styles_module_default6.importFlash,
            children: importMsg
          }, undefined, false, undefined, this) : null
        ]
      }, undefined, true, undefined, this),
      mode === "simple" && /* @__PURE__ */ jsxDEV12("div", {
        className: styles_module_default6.tabs,
        role: "tablist",
        "aria-label": "Simple ladder",
        "data-tour": "css-tabs",
        children: SIMPLE_TABS.map(([id, label]) => /* @__PURE__ */ jsxDEV12("button", {
          type: "button",
          role: "tab",
          "aria-selected": simpleTab === id,
          className: simpleTab === id ? `${styles_module_default6.tab} ${styles_module_default6.tabOn}` : styles_module_default6.tab,
          onClick: () => setSimpleTab(id),
          children: label
        }, id, false, undefined, this))
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV12("div", {
        className: styles_module_default6.previewBlock,
        "data-tour": "css-preview",
        children: /* @__PURE__ */ jsxDEV12("iframe", {
          className: styles_module_default6.frame,
          title: "Sealed CSS preview",
          sandbox: "",
          srcDoc,
          referrerPolicy: "no-referrer"
        }, undefined, false, undefined, this)
      }, undefined, false, undefined, this),
      mode === "simple" && simpleTab === "starters" && /* @__PURE__ */ jsxDEV12(CssStarters, {
        packId,
        packBlurb: pack5.blurb,
        onApply: applyRecipe
      }, undefined, false, undefined, this),
      mode === "simple" && simpleTab === "assist" && /* @__PURE__ */ jsxDEV12(CssAssistPane, {
        pack: pack5,
        doc,
        selected,
        onSelectRule: setRuleId,
        onAddRule: addRule,
        onRuleChange,
        onDeleteRule: (id) => {
          commitDoc(removeRule(doc, id));
          setRuleId(null);
        }
      }, undefined, false, undefined, this),
      mode === "simple" && simpleTab === "source" && /* @__PURE__ */ jsxDEV12(CssSourcePane, {
        value,
        onChange,
        onChip: applyChip
      }, undefined, false, undefined, this),
      mode === "advanced" && /* @__PURE__ */ jsxDEV12(CssAdvancedPane, {
        value,
        onChange,
        doc,
        selected,
        onSelectRule: setRuleId,
        onRuleChange,
        onChip: applyChip
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}

// src/ui/components/ink-dialog/index.tsx
import { useEffect as useEffect4, useRef as useRef5 } from "react";
import { createPortal as createPortal2 } from "react-dom";

// src/ui/components/ink-dialog/styles.module.css
var styles_module_default7 = {
  overlay: "overlay_wz5sqg",
  sheet: "sheet_wz5sqg"
};

// src/ui/components/ink-dialog/index.tsx
import { jsxDEV as jsxDEV13 } from "react/jsx-dev-runtime";
function InkDialog({ children, onDismiss, ariaLabel, sheetClassName }) {
  const sheetRef = useRef5(null);
  useEffect4(() => {
    const onKey = (e) => {
      if (e.key !== "Escape")
        return;
      const inner = e.target instanceof Element ? e.target.closest('[role="dialog"][aria-modal="true"]') : null;
      if (inner && inner !== sheetRef.current)
        return;
      onDismiss();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onDismiss]);
  const onOverlayClick = (e) => {
    if (e.target === e.currentTarget)
      onDismiss();
  };
  return createPortal2(/* @__PURE__ */ jsxDEV13("div", {
    className: styles_module_default7.overlay,
    onClick: onOverlayClick,
    children: /* @__PURE__ */ jsxDEV13("div", {
      ref: sheetRef,
      className: sheetClassName ? `${styles_module_default7.sheet} ${sheetClassName}` : styles_module_default7.sheet,
      role: "dialog",
      "aria-modal": "true",
      "aria-label": ariaLabel,
      children
    }, undefined, false, undefined, this)
  }, undefined, false, undefined, this), document.body);
}

// src/ui/components/tour-guide/index.tsx
import { useEffect as useEffect5, useState as useState6 } from "react";

// src/ui/tours/tour-core.ts
var tourSeenKey = (appId) => `tour.${appId}.seen`;
var hasSeenTour = (prefValue) => prefValue === true;
function positionAt(tour, rawIndex) {
  const total = tour.steps.length;
  if (total === 0)
    return { step: null, index: 0, total: 0, human: 0, isFirst: true, isLast: true };
  const index = Math.max(0, Math.min(Math.trunc(rawIndex) || 0, total - 1));
  return {
    step: tour.steps[index],
    index,
    total,
    human: index + 1,
    isFirst: index === 0,
    isLast: index === total - 1
  };
}
var nextIndex = (tour, index) => Math.min(Math.max(0, index) + 1, Math.max(0, tour.steps.length - 1));
var prevIndex = (index) => Math.max(0, index - 1);
function planOpenAct(openPieceCount, libraryCharacterCount) {
  if (openPieceCount > 0)
    return "focused";
  if (libraryCharacterCount > 0)
    return "opened";
  return "created";
}
function stepBody(step, outcome) {
  if (outcome !== null && step.bodyBy?.[outcome] !== undefined)
    return step.bodyBy[outcome];
  return step.body;
}

// src/core/canonical.ts
var CANONICAL_SCHEMA_VERSION = "1";

// src/ui/_shared/new-character.ts
async function createAndOpenCharacter(ctx) {
  const name = "Untitled character";
  const saved = await ctx.api.saveEntity({
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    kind: "character",
    id: "character",
    body: {
      identity: { name },
      persona: {},
      prompts: {},
      greetings: {},
      examples: {},
      media: {},
      attribution: {},
      discovery: {}
    }
  });
  return { id: saved.id, kind: "character", name: saved.name || name, accent: saved.accent };
}

// src/ui/components/mono-tag/styles.module.css
var styles_module_default8 = {
  tag: "tag_C_dYbA",
  tagDim: "tag_C_dYbA tagDim_C_dYbA"
};

// src/ui/components/mono-tag/index.tsx
import { jsxDEV as jsxDEV14 } from "react/jsx-dev-runtime";
function MonoTag({ children, dim }) {
  return /* @__PURE__ */ jsxDEV14("span", {
    className: dim ? styles_module_default8.tagDim : styles_module_default8.tag,
    children
  }, undefined, false, undefined, this);
}

// src/ui/components/tour-guide/styles.module.css
var styles_module_default9 = {
  rail: "rail_13SYuA",
  kick: "kick_13SYuA",
  skip: "skip_13SYuA",
  dots: "dots_13SYuA",
  done: "done_13SYuA",
  now: "now_13SYuA",
  count: "count_13SYuA",
  title: "title_13SYuA",
  noAnchor: "noAnchor_13SYuA",
  body: "body_13SYuA",
  choice: "choice_13SYuA",
  pick: "pick_13SYuA",
  pickOn: "pickOn_13SYuA",
  ctl: "ctl_13SYuA",
  back: "back_13SYuA",
  next: "next_13SYuA",
  tourHl: "tourHl_13SYuA"
};

// src/ui/components/tour-guide/index.tsx
import { jsxDEV as jsxDEV15, Fragment as Fragment2 } from "react/jsx-dev-runtime";
var HL_CLASS = "tourHl";
function TourGuide({ tour, ctx, onClose }) {
  const [index, setIndex] = useState6(0);
  const [openOutcome, setOpenOutcome] = useState6(null);
  const [highlightLive, setHighlightLive] = useState6(null);
  const pos = positionAt(tour, index);
  const anchor = pos.step?.anchor;
  useEffect5(() => {
    const act = pos.step?.act;
    if (!act)
      return;
    if (act.setPref)
      ctx.prefs.set(act.setPref.key, act.setPref.value);
    if (act.open === "piece") {
      (async () => {
        const open = ctx.workbench.pieces();
        const chars = open.length > 0 ? [] : await ctx.api.listEntities("character");
        const plan = planOpenAct(open.length, chars.length);
        setOpenOutcome(plan);
        if (plan === "focused") {
          ctx.workbench.focus(open[0].id, open[0].kind);
        } else if (plan === "opened") {
          ctx.workbench.open(chars[0]);
        } else {
          ctx.workbench.open(await createAndOpenCharacter(ctx));
        }
      })();
    }
  }, [pos.step?.id]);
  useEffect5(() => {
    if (!anchor) {
      setHighlightLive(null);
      return;
    }
    let raf = 0;
    let tries = 0;
    setHighlightLive(null);
    const paint = () => {
      const el = document.querySelector(`[data-tour="${anchor}"]`);
      if (!el) {
        if (tries++ < 40) {
          raf = requestAnimationFrame(paint);
        } else {
          setHighlightLive(false);
        }
        return;
      }
      setHighlightLive(true);
      el.classList.add(HL_CLASS);
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    };
    paint();
    return () => {
      cancelAnimationFrame(raf);
      document.querySelector(`[data-tour="${anchor}"]`)?.classList.remove(HL_CLASS);
    };
  }, [anchor]);
  const finish = () => {
    ctx.prefs.set(tourSeenKey(tour.manifest.appId), true);
    onClose();
  };
  const step = pos.step;
  if (!step)
    return /* @__PURE__ */ jsxDEV15(Fragment2, {}, undefined, false, undefined, this);
  return /* @__PURE__ */ jsxDEV15("aside", {
    className: styles_module_default9.rail,
    role: "dialog",
    "aria-label": `${tour.manifest.title} tour`,
    children: [
      /* @__PURE__ */ jsxDEV15("div", {
        className: styles_module_default9.kick,
        children: [
          /* @__PURE__ */ jsxDEV15(MonoTag, {
            children: tour.manifest.title
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV15("button", {
            type: "button",
            className: styles_module_default9.skip,
            onClick: finish,
            children: "skip"
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV15("div", {
        className: styles_module_default9.dots,
        "aria-hidden": "true",
        children: tour.steps.map((s, i) => /* @__PURE__ */ jsxDEV15("i", {
          className: i < index ? styles_module_default9.done : i === index ? styles_module_default9.now : undefined
        }, s.id, false, undefined, this))
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV15("div", {
        className: styles_module_default9.count,
        children: [
          pos.human,
          " of ",
          pos.total
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV15("h3", {
        className: styles_module_default9.title,
        children: step.title
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV15("p", {
        className: styles_module_default9.body,
        children: stepBody(step, openOutcome)
      }, undefined, false, undefined, this),
      highlightLive === false && /* @__PURE__ */ jsxDEV15("p", {
        className: styles_module_default9.noAnchor,
        children: "The control this step points at is not on this screen right now."
      }, undefined, false, undefined, this),
      step.choice && /* @__PURE__ */ jsxDEV15("div", {
        className: styles_module_default9.choice,
        children: step.choice.options.map((o) => {
          const on = ctx.prefs.get(step.choice.prefKey) === o.value;
          return /* @__PURE__ */ jsxDEV15("button", {
            type: "button",
            className: on ? `${styles_module_default9.pick} ${styles_module_default9.pickOn}` : styles_module_default9.pick,
            onClick: () => ctx.prefs.set(step.choice.prefKey, o.value),
            "aria-pressed": on,
            children: [
              /* @__PURE__ */ jsxDEV15("b", {
                children: o.label
              }, undefined, false, undefined, this),
              o.sub ? /* @__PURE__ */ jsxDEV15("span", {
                children: o.sub
              }, undefined, false, undefined, this) : null
            ]
          }, o.value, true, undefined, this);
        })
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV15("div", {
        className: styles_module_default9.ctl,
        children: [
          /* @__PURE__ */ jsxDEV15("button", {
            type: "button",
            className: styles_module_default9.back,
            disabled: pos.isFirst,
            onClick: () => setIndex(prevIndex(index)),
            children: "back"
          }, undefined, false, undefined, this),
          pos.isLast ? /* @__PURE__ */ jsxDEV15("button", {
            type: "button",
            className: styles_module_default9.next,
            onClick: finish,
            children: "Done"
          }, undefined, false, undefined, this) : /* @__PURE__ */ jsxDEV15("button", {
            type: "button",
            className: styles_module_default9.next,
            onClick: () => setIndex(nextIndex(tour, index)),
            children: "Next"
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this)
    ]
  }, undefined, true, undefined, this);
}

// src/ui/apps/css-workshop/actions.ts
async function copyText(text2) {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text2);
      return true;
    }
  } catch {}
  if (typeof document === "undefined")
    return false;
  try {
    const ta = document.createElement("textarea");
    ta.value = text2;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
function downloadCss(text2, filename = "vaude-style.css") {
  if (typeof document === "undefined")
    return;
  const blob = new Blob([text2], { type: "text/css;charset=utf-8" });
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

// src/ui/apps/css-workshop/prefs.ts
var PREF_DRAFT = "css-workshop.draft";
var PREF_PACK = "css-workshop.packId";
var DEFAULT_PACK_ID = "universal";
var STARTER_CSS = `/* CSS Workshop draft
 * Starters and Assist help; Source is the truth.
 * Paste this onto Chub, Janitor, Risu backdrop, or any host that takes CSS.
 */
.card {
  background: #1a1820;
  color: #e8e4ef;
  border-radius: 12px;
  padding: 12px 14px;
  border: 1px solid #2e2a38;
}
`;
var asPrefString = (v, fallback) => typeof v === "string" ? v : fallback;

// src/ui/apps/css-workshop/tour.ts
var cssWorkshopTour = {
  manifest: { appId: "css-workshop", title: "CSS Workshop" },
  steps: [
    {
      id: "welcome",
      title: "This is the CSS Workshop",
      body: "Two modes: Simple (guided ladder) and Advanced (code plus rule breakdown). Flip the Simple / Advanced toggle anytime."
    },
    {
      id: "mode",
      anchor: "css-mode",
      title: "Simple or Advanced",
      body: "Simple is Starters, Assist, and Source. Advanced is free coding with a live breakdown of your rules. Same CSS either way."
    },
    {
      id: "preview",
      anchor: "css-preview",
      title: "Sealed preview",
      body: "The mock is sandboxed. Hoplight never applies this CSS to the app chrome. Hosts apply it when you paste."
    },
    {
      id: "starters",
      anchor: "css-starters",
      title: "Start with a starter",
      body: "In Simple mode, open Starters, pick a pack, press Use this. Then tune in Assist or Source."
    },
    {
      id: "advanced",
      anchor: "css-advanced",
      title: "Advanced is code plus breakdown",
      body: "Write on the left. Parsed rules appear on the right. Click a rule for knobs. Import a .css file to load a sheet and see it broken down."
    },
    {
      id: "done",
      title: "You are set",
      body: "Drafts live in prefs. Card-bound CSS still lives on the piece in the Workbench under Platform · Chub."
    }
  ]
};
var tour_default = cssWorkshopTour;

// src/ui/apps/css-workshop/styles.module.css
var styles_module_default10 = {
  room: "room_cQgX6g",
  head: "head_cQgX6g",
  titles: "titles_cQgX6g",
  eyebrow: "eyebrow_cQgX6g",
  title: "title_cQgX6g",
  lede: "lede_cQgX6g",
  actions: "actions_cQgX6g",
  modeToggle: "modeToggle_cQgX6g",
  modeBtn: "modeBtn_cQgX6g",
  modeOn: "modeOn_cQgX6g",
  btn: "btn_cQgX6g",
  btnPrimary: "btnPrimary_cQgX6g",
  btnGhost: "btnGhost_cQgX6g",
  stage: "stage_cQgX6g",
  flash: "flash_cQgX6g",
  fileInput: "fileInput_cQgX6g",
  clearSheet: "clearSheet_cQgX6g",
  clearTitle: "clearTitle_cQgX6g",
  clearBody: "clearBody_cQgX6g",
  clearActs: "clearActs_cQgX6g",
  clearGo: "clearGo_cQgX6g",
  clearKeep: "clearKeep_cQgX6g"
};

// src/ui/apps/css-workshop/room.tsx
import { jsxDEV as jsxDEV16 } from "react/jsx-dev-runtime";
var NOTE = "Standalone draft. Hoplight never applies this to the app chrome. Copy or download to paste on Chub, Janitor, Risu, or anywhere that takes CSS. Card-bound CSS still lives on the piece in the Workbench.";
var PREF_MODE = "css-workshop.mode";
var asMode = (v) => v === "advanced" ? "advanced" : "simple";
function CssWorkshopRoom({ ctx }) {
  const [css, setCss] = useState7(() => asPrefString(ctx.prefs.get(PREF_DRAFT), STARTER_CSS));
  const [packId, setPackId] = useState7(() => asPrefString(ctx.prefs.get(PREF_PACK), DEFAULT_PACK_ID));
  const [mode, setMode] = useState7(() => asMode(ctx.prefs.get(PREF_MODE)));
  const [simpleTab, setSimpleTab] = useState7(() => asPrefString(ctx.prefs.get(PREF_DRAFT), STARTER_CSS).trim() === "" ? "starters" : "assist");
  const [flash, setFlash] = useState7("");
  const [tourOpen, setTourOpen] = useState7(false);
  const [clearOpen, setClearOpen] = useState7(false);
  const fileRef = useRef6(null);
  useEffect6(() => {
    ctx.setStatus(mode === "advanced" ? "css workshop · advanced" : "css workshop · simple");
  }, [ctx, mode]);
  useEffect6(() => {
    if (hasSeenTour(ctx.prefs.get(tourSeenKey("css-workshop"))))
      return;
    const t = window.setTimeout(() => setTourOpen(true), 400);
    return () => window.clearTimeout(t);
  }, [ctx]);
  const persist = useCallback3((next) => {
    setCss(next);
    ctx.prefs.set(PREF_DRAFT, next);
  }, [ctx]);
  const persistPack = useCallback3((id) => {
    setPackId(id);
    ctx.prefs.set(PREF_PACK, id);
  }, [ctx]);
  const persistMode = useCallback3((next) => {
    setMode(next);
    ctx.prefs.set(PREF_MODE, next);
  }, [ctx]);
  const onCopy = async () => {
    const ok = await copyText(css);
    setFlash(ok ? "copied plain CSS" : "copy failed - open Source and copy manually");
    ctx.setStatus(ok ? "css workshop · copied" : "css workshop · copy failed");
  };
  const onDownload = () => {
    downloadCss(css, "vaude-style.css");
    setFlash("downloaded vaude-style.css");
    ctx.setStatus("css workshop · downloaded");
  };
  const onClear = () => {
    setClearOpen(false);
    persist("");
    persistMode("simple");
    setSimpleTab("starters");
    setFlash("draft cleared");
    ctx.setStatus("css workshop · cleared");
  };
  const onImportFile = async (file) => {
    if (!looksLikeCssFile(file.name) && file.type && !file.type.includes("css") && !file.type.includes("text")) {
      setFlash("pick a .css file");
      return;
    }
    try {
      const text2 = await readCssFile(file);
      const sum = summarizeImport(text2);
      persist(text2);
      persistMode("advanced");
      const free = sum.freeform ? " · freeform kept" : "";
      setFlash(`imported ${file.name} · ${sum.rules} rule${sum.rules === 1 ? "" : "s"}${free}`);
      ctx.setStatus(`css workshop · imported ${sum.rules} rules`);
    } catch {
      setFlash("could not read that file");
      ctx.setStatus("css workshop · import failed");
    }
  };
  const onFileChange = (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f)
      onImportFile(f);
  };
  return /* @__PURE__ */ jsxDEV16("div", {
    className: styles_module_default10.room,
    children: [
      /* @__PURE__ */ jsxDEV16("header", {
        className: styles_module_default10.head,
        children: [
          /* @__PURE__ */ jsxDEV16("div", {
            className: styles_module_default10.titles,
            children: [
              /* @__PURE__ */ jsxDEV16("span", {
                className: styles_module_default10.eyebrow,
                children: "App · style"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV16("h1", {
                className: styles_module_default10.title,
                children: "CSS Workshop"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV16("p", {
                className: styles_module_default10.lede,
                children: "Simple mode is the guided ladder. Advanced is code plus rule breakdown. Flip anytime. Import a .css file to load it into Advanced."
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ jsxDEV16("div", {
            className: styles_module_default10.actions,
            children: [
              /* @__PURE__ */ jsxDEV16("div", {
                className: styles_module_default10.modeToggle,
                role: "group",
                "aria-label": "Editor mode",
                children: [
                  /* @__PURE__ */ jsxDEV16("button", {
                    type: "button",
                    className: mode === "simple" ? `${styles_module_default10.modeBtn} ${styles_module_default10.modeOn}` : styles_module_default10.modeBtn,
                    "aria-pressed": mode === "simple",
                    onClick: () => persistMode("simple"),
                    children: "Simple"
                  }, undefined, false, undefined, this),
                  /* @__PURE__ */ jsxDEV16("button", {
                    type: "button",
                    className: mode === "advanced" ? `${styles_module_default10.modeBtn} ${styles_module_default10.modeOn}` : styles_module_default10.modeBtn,
                    "aria-pressed": mode === "advanced",
                    onClick: () => persistMode("advanced"),
                    children: "Advanced"
                  }, undefined, false, undefined, this)
                ]
              }, undefined, true, undefined, this),
              /* @__PURE__ */ jsxDEV16("button", {
                type: "button",
                className: `${styles_module_default10.btn} ${styles_module_default10.btnPrimary}`,
                onClick: () => void onCopy(),
                children: "copy CSS"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV16("button", {
                type: "button",
                className: styles_module_default10.btn,
                onClick: onDownload,
                children: "download .css"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV16("button", {
                type: "button",
                className: styles_module_default10.btn,
                onClick: () => fileRef.current?.click(),
                children: "import .css"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV16("input", {
                ref: fileRef,
                type: "file",
                className: styles_module_default10.fileInput,
                accept: CSS_FILE_ACCEPT,
                "aria-label": "Import CSS file",
                onChange: onFileChange
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV16("button", {
                type: "button",
                className: `${styles_module_default10.btn} ${styles_module_default10.btnGhost}`,
                onClick: () => setClearOpen(true),
                children: "clear draft"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV16("button", {
                type: "button",
                className: `${styles_module_default10.btn} ${styles_module_default10.btnGhost}`,
                onClick: () => setTourOpen(true),
                children: "tour"
              }, undefined, false, undefined, this),
              flash ? /* @__PURE__ */ jsxDEV16("span", {
                className: styles_module_default10.flash,
                children: flash
              }, undefined, false, undefined, this) : null
            ]
          }, undefined, true, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV16("div", {
        className: styles_module_default10.stage,
        children: /* @__PURE__ */ jsxDEV16(CssWorkshop, {
          value: css,
          onChange: persist,
          defaultPackId: packId,
          onPackChange: persistPack,
          note: NOTE,
          mode,
          onModeChange: persistMode,
          simpleTab,
          onSimpleTabChange: setSimpleTab
        }, undefined, false, undefined, this)
      }, undefined, false, undefined, this),
      tourOpen && /* @__PURE__ */ jsxDEV16(TourGuide, {
        tour: tour_default,
        ctx,
        onClose: () => setTourOpen(false)
      }, undefined, false, undefined, this),
      clearOpen && /* @__PURE__ */ jsxDEV16(InkDialog, {
        onDismiss: () => setClearOpen(false),
        ariaLabel: "Clear the draft",
        children: /* @__PURE__ */ jsxDEV16("div", {
          className: styles_module_default10.clearSheet,
          children: [
            /* @__PURE__ */ jsxDEV16("b", {
              className: styles_module_default10.clearTitle,
              children: "Clear the draft?"
            }, undefined, false, undefined, this),
            /* @__PURE__ */ jsxDEV16("p", {
              className: styles_module_default10.clearBody,
              children: "Your unsaved CSS goes away."
            }, undefined, false, undefined, this),
            /* @__PURE__ */ jsxDEV16("div", {
              className: styles_module_default10.clearActs,
              children: [
                /* @__PURE__ */ jsxDEV16("button", {
                  type: "button",
                  className: styles_module_default10.clearGo,
                  onClick: onClear,
                  children: "Clear"
                }, undefined, false, undefined, this),
                /* @__PURE__ */ jsxDEV16("button", {
                  type: "button",
                  className: styles_module_default10.clearKeep,
                  onClick: () => setClearOpen(false),
                  children: "Keep"
                }, undefined, false, undefined, this)
              ]
            }, undefined, true, undefined, this)
          ]
        }, undefined, true, undefined, this)
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}

// src/ui/apps/css-workshop/index.tsx
import { jsxDEV as jsxDEV17 } from "react/jsx-dev-runtime";
var MARK_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">' + '<path d="M12 3c-4.5 0-8 3.2-8 7.2 0 2.6 1.4 4.9 3.6 6.2V20h3.2v-2.1c.7.1 1.4.2 2.2.2 4.5 0 8-3.2 8-7.2S16.5 3 12 3z"/>' + '<circle cx="8.2" cy="10" r="1.1" fill="currentColor" stroke="none"/>' + '<circle cx="11.5" cy="7.8" r="1.1" fill="currentColor" stroke="none"/>' + '<circle cx="15" cy="10.2" r="1.1" fill="currentColor" stroke="none"/>' + "</svg>";
var app = {
  manifest: {
    id: "css-workshop",
    title: "CSS Workshop",
    markSvg: MARK_SVG,
    accent: "#7c3aed",
    order: 35,
    catalogOnly: true,
    subtitle: "app · style",
    agentSurface: {
      describe: "Assisted CSS authoring room. Starters, property knobs, plain CSS source, sealed preview. Copy or download for any host."
    }
  },
  Component: ({ ctx }) => /* @__PURE__ */ jsxDEV17(CssWorkshopRoom, {
    ctx
  }, undefined, false, undefined, this)
};
var css_workshop_default = app;
export {
  css_workshop_default as default
};
