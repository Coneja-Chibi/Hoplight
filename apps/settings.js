{const s=document.createElement("style");s.dataset.vaudeModuleCss="1";s.textContent="/* src/ui/apps/settings/styles.module.css */\n.roomHost_6FRrQA {\n  container-type: inline-size;\n  display: flex;\n  flex-direction: column;\n  flex: 1;\n  min-height: 0;\n}\n\n.room_6FRrQA {\n  display: flex;\n  flex-direction: column;\n  flex: 1;\n  gap: .7rem;\n  min-height: 0;\n  padding: clamp(.7rem, 1.8vw, 1.1rem);\n}\n\n.tabs_6FRrQA {\n  display: flex;\n  flex-wrap: wrap;\n  flex: none;\n  gap: .4rem;\n}\n\n.tab_6FRrQA {\n  font-family: var(--font-big);\n  letter-spacing: .08em;\n  text-transform: uppercase;\n  color: var(--text-dim);\n  background: var(--face);\n  border: 3px solid var(--edge);\n  box-shadow: 3px 3px 0 0 var(--edge);\n  cursor: pointer;\n  padding: .4rem .8rem;\n  transition: transform .1s ease-out, box-shadow .1s ease-out;\n  font-size: .6875rem;\n  font-weight: 800;\n}\n\n.tab_6FRrQA:hover {\n  box-shadow: 4px 4px 0 0 var(--edge);\n  transform: translate(-1px, -1px);\n}\n\n.tab_6FRrQA.on_6FRrQA {\n  background: var(--stamp-bg);\n  color: var(--stamp-fg);\n  box-shadow: 3px 3px 0 0 var(--accent);\n}\n\n.body_6FRrQA {\n  overflow-y: auto;\n  background: var(--shell-panel);\n  border: 3px solid var(--edge);\n  box-shadow: 6px 6px 0 0 var(--edge);\n  display: flex;\n  flex-direction: column;\n  flex: 1;\n  gap: 1rem;\n  min-height: 0;\n  padding: clamp(.8rem, 2vw, 1.4rem);\n}\n\n.row_6FRrQA {\n  display: flex;\n  border-bottom: 2px solid var(--seam);\n  flex-wrap: wrap;\n  justify-content: space-between;\n  align-items:  flex-start;\n  gap: 1rem;\n  padding-bottom: 1rem;\n}\n\n.row_6FRrQA:last-child {\n  border-bottom: none;\n  padding-bottom: 0;\n}\n\n.tx_6FRrQA {\n  flex: 1;\n  min-width: 12rem;\n}\n\n.label_6FRrQA {\n  font-family: var(--font-big);\n  color: var(--text);\n  font-size: .9rem;\n  font-weight: 800;\n}\n\n.hint_6FRrQA {\n  font-family: var(--font-mono);\n  color: var(--text-soft, var(--text-dim));\n  max-width: 46rem;\n  margin-top: .2rem;\n  font-size: .72rem;\n  font-weight: 500;\n  line-height: 1.6;\n}\n\n.statusNote_6FRrQA {\n  font-family: var(--font-mono);\n  color: var(--text);\n  align-self:  center;\n  font-size: .7rem;\n  font-weight: 600;\n}\n\n.seg_6FRrQA {\n  display: flex;\n  border: 3px solid var(--edge);\n  box-shadow: 3px 3px 0 0 var(--edge);\n  flex-wrap: wrap;\n}\n\n.seg_6FRrQA button {\n  border: none;\n  border-left: 3px solid var(--edge);\n  background: var(--face);\n  color: var(--text-dim);\n  font-family: var(--font-big);\n  letter-spacing: .08em;\n  text-transform: uppercase;\n  cursor: pointer;\n  padding: .45rem .8rem;\n  font-size: .6875rem;\n  font-weight: 800;\n}\n\n.seg_6FRrQA button:first-child {\n  border-left: none;\n}\n\n.seg_6FRrQA button.on_6FRrQA {\n  background: var(--stamp-bg);\n  color: var(--stamp-fg);\n}\n\n.plates_6FRrQA {\n  display: flex;\n  flex-wrap: wrap;\n  gap: .4rem;\n  max-width: 26rem;\n}\n\n.plate_6FRrQA {\n  font-family: var(--font-mono);\n  letter-spacing: .06em;\n  text-transform: uppercase;\n  color: var(--text-dim);\n  border: 2px dashed var(--text-faint);\n  cursor: pointer;\n  background: none;\n  padding: .45rem .7rem;\n  font-size: .6875rem;\n  font-weight: 700;\n}\n\n.plate_6FRrQA.on_6FRrQA {\n  border: 3px solid var(--accent);\n  color: var(--text);\n  background: var(--face);\n  border-style: solid;\n}\n\n.room_6FRrQA * {\n  scrollbar-width: thin;\n  scrollbar-color: var(--stage-seam) transparent;\n}\n\n.plateDanger_6FRrQA {\n  border-color: var(--stage-danger-edge);\n  color: var(--stage-danger-text);\n  background: color-mix(in srgb, var(--stage-danger-edge) 12%, transparent);\n}\n\n.pathNote_6FRrQA {\n  font-family: var(--font-mono);\n  color: var(--stage-soft);\n  word-break: break-all;\n  text-align: right;\n  max-width: 28rem;\n  font-size: .66rem;\n}\n\n@container (width <= 40rem) {\n  .room_6FRrQA {\n    padding: .5rem;\n    gap: .5rem;\n  }\n\n  .row_6FRrQA {\n    flex-direction: column;\n    gap: .5rem;\n  }\n}\n\n/* src/ui/components/color-picker/styles.module.css */\n.cp_SWqr_A {\n  display: flex;\n  flex-direction: column;\n  gap: .55rem;\n  width: clamp(11rem, 17rem, 100%);\n}\n\n.sv_SWqr_A {\n  position: relative;\n  aspect-ratio: 3 / 2;\n  border: 3px solid var(--ink);\n  box-shadow: 4px 4px 0 0 var(--ink);\n  cursor: crosshair;\n  touch-action: none;\n  width: 100%;\n}\n\n.hue_SWqr_A {\n  position: relative;\n  border: 3px solid var(--ink);\n  box-shadow: 3px 3px 0 0 var(--ink);\n  cursor: ew-resize;\n  touch-action: none;\n  background: linear-gradient(to right, red, #ff0, #0f0, #0ff, #00f, #f0f, red);\n  width: 100%;\n  height: 1rem;\n}\n\n.thumb_SWqr_A {\n  position: absolute;\n  border: 3px solid var(--stage-white);\n  outline: 2px solid var(--stage-black);\n  pointer-events: none;\n  box-shadow: 0 0 0 1px var(--stage-black);\n  border-radius: 50%;\n  width: 14px;\n  height: 14px;\n  transform: translate(-50%, -50%);\n}\n\n.foot_SWqr_A {\n  display: flex;\n  align-items:  center;\n  gap: .5rem;\n}\n\n.chip_SWqr_A {\n  border: 3px solid var(--ink);\n  box-shadow: 2px 2px 0 0 var(--ink);\n  flex: none;\n  width: 1.6rem;\n  height: 1.6rem;\n}\n\n.hex_SWqr_A {\n  font-family: var(--font-mono);\n  letter-spacing: .06em;\n  text-transform: uppercase;\n  color: var(--ink);\n  background: var(--paper);\n  border: 3px solid var(--ink);\n  flex: 1;\n  min-width: 0;\n  padding: .4rem .55rem;\n  font-size: .8rem;\n  font-weight: 700;\n}\n\n.hex_SWqr_A:focus {\n  outline: none;\n  box-shadow: 3px 3px 0 0 var(--ink);\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .sv_SWqr_A, .hue_SWqr_A {\n    transition: none;\n  }\n}\n\n/* src/ui/components/paint-picker/styles.module.css */\n.pp_655Ssw {\n  display: flex;\n  flex-direction: column;\n  gap: .6rem;\n  width: clamp(11rem, 17rem, 100%);\n}\n\n.modes_655Ssw {\n  display: flex;\n  border: 3px solid var(--ink);\n  box-shadow: 3px 3px 0 0 var(--ink);\n}\n\n.modes_655Ssw button {\n  border: none;\n  border-left: 3px solid var(--ink);\n  background: var(--paper);\n  font-family: var(--font-mono), monospace;\n  letter-spacing: .08em;\n  text-transform: uppercase;\n  color: var(--ink);\n  cursor: pointer;\n  flex: 1;\n  padding: .42rem;\n  font-size: .625rem;\n  font-weight: 700;\n}\n\n.modes_655Ssw button:first-child {\n  border-left: none;\n}\n\n.modes_655Ssw button.on_655Ssw {\n  background: var(--ink);\n  color: var(--paper);\n}\n\n.grad_655Ssw {\n  display: flex;\n  flex-direction: column;\n  gap: .55rem;\n}\n\n.bar_655Ssw {\n  position: relative;\n  border: 3px solid var(--ink);\n  box-shadow: 3px 3px 0 0 var(--ink);\n  cursor: copy;\n  touch-action: none;\n  width: 100%;\n  height: 1.5rem;\n  margin-top: .5rem;\n}\n\n.stop_655Ssw {\n  position: absolute;\n  border: 3px solid var(--ink);\n  cursor: grab;\n  touch-action: none;\n  box-shadow: 0 0 0 2px var(--paper);\n  width: 14px;\n  height: 2rem;\n  top: 50%;\n  transform: translate(-50%, -50%);\n}\n\n.stop_655Ssw.sel_655Ssw {\n  box-shadow: 0 0 0 2px var(--paper), 0 0 0 5px var(--ink);\n  z-index: 2;\n}\n\n.row_655Ssw {\n  display: flex;\n  align-items:  center;\n  gap: .5rem;\n}\n\n.out_655Ssw {\n  border: 3px solid var(--ink);\n  box-shadow: 2px 2px 0 0 var(--ink);\n  flex: none;\n  width: 1.7rem;\n  height: 1.7rem;\n}\n\n.seg_655Ssw {\n  display: flex;\n  border: 3px solid var(--ink);\n}\n\n.seg_655Ssw button {\n  border: none;\n  border-left: 3px solid var(--ink);\n  background: var(--paper);\n  font-family: var(--font-mono), monospace;\n  letter-spacing: .06em;\n  text-transform: uppercase;\n  color: var(--ink);\n  cursor: pointer;\n  padding: .32rem .55rem;\n  font-size: .625rem;\n  font-weight: 700;\n}\n\n.seg_655Ssw button:first-child {\n  border-left: none;\n}\n\n.seg_655Ssw button.on_655Ssw {\n  background: var(--ink);\n  color: var(--paper);\n}\n\n.rm_655Ssw {\n  font-family: var(--font-mono), monospace;\n  letter-spacing: .06em;\n  text-transform: uppercase;\n  background: var(--paper);\n  border: 3px solid var(--ink);\n  color: var(--ink);\n  cursor: pointer;\n  margin-left: auto;\n  padding: .32rem .55rem;\n  font-size: .625rem;\n  font-weight: 700;\n}\n\n.rm_655Ssw:disabled {\n  opacity: .4;\n  cursor: not-allowed;\n}\n\n.angle_655Ssw {\n  display: flex;\n  align-items:  center;\n  gap: .5rem;\n}\n\n.angle_655Ssw input {\n  flex: 1;\n  min-width: 0;\n}\n\n.deg_655Ssw {\n  font-family: var(--font-mono), monospace;\n  color: var(--ink);\n  text-align: right;\n  min-width: 2.6rem;\n  font-size: .625rem;\n  font-weight: 700;\n}\n\n/* src/ui/components/swatch-row/styles.module.css */\n.wrap_OmPbpg {\n  display: flex;\n  flex-direction: column;\n  gap: .5rem;\n}\n\n.row_OmPbpg {\n  display: flex;\n  flex-wrap: wrap;\n  justify-content: flex-start;\n  gap: .9rem;\n  padding: .4rem 0 1.9rem;\n}\n\n.sw_OmPbpg {\n  aspect-ratio: 1;\n  border: 3px solid var(--ink);\n  cursor: pointer;\n  position: relative;\n  font-family: var(--font-mono);\n  box-shadow: 4px 4px 0 0 var(--ink);\n  width: clamp(3rem, 8vw, 3.5rem);\n  padding: 0;\n  transition: transform .1s ease-out, box-shadow .1s ease-out;\n}\n\n.sw_OmPbpg:hover {\n  box-shadow: 6px 6px 0 0 var(--ink);\n  transform: translate(-2px, -2px);\n}\n\n.sw_OmPbpg:active, .sw_OmPbpg.on_OmPbpg {\n  box-shadow: 1px 1px 0 0 var(--ink);\n  transform: translate(3px, 3px);\n}\n\n.sw_OmPbpg.on_OmPbpg:after {\n  content: \"\";\n  position: absolute;\n  border: 3px solid var(--ink);\n  inset: -9px;\n}\n\n.sw_OmPbpg .lbl_OmPbpg {\n  position: absolute;\n  text-align: center;\n  font-family: var(--font-mono);\n  letter-spacing: .07em;\n  color: var(--text);\n  font-size: .66rem;\n  font-weight: 600;\n  bottom: -1.4rem;\n  left: 0;\n  right: 0;\n}\n\n.sw_OmPbpg.custom_OmPbpg {\n  background: conic-gradient(from 0deg, var(--rose), #f59e0b, #10b981, #3b82f6, #8b5cf6, var(--rose));\n}\n\n.sw_OmPbpg.custom_OmPbpg.empty_OmPbpg:before {\n  content: \"+\";\n  position: absolute;\n  display: flex;\n  font-family: var(--font-big);\n  color: var(--stage-white);\n  text-shadow: 0 1px 3px var(--shadow-ink);\n  justify-content: center;\n  align-items:  center;\n  font-size: 1.4rem;\n  font-weight: 900;\n  inset: 0;\n}\n\n.panel_OmPbpg {\n  padding-top: .2rem;\n}\n\n@media (prefers-reduced-motion: reduce) {\n  .sw_OmPbpg {\n    transition: none;\n  }\n}\n\n/* src/ui/apps/settings/sections/connections.module.css */\n.list_y_OAsA {\n  list-style: none;\n  display: flex;\n  flex-direction: column;\n  gap: .4rem;\n  margin: 0;\n  padding: 0;\n}\n\n.empty_y_OAsA {\n  color: var(--text-dim);\n  padding: .5rem 0;\n  font-style: italic;\n}\n\n.row_y_OAsA {\n  display: grid;\n  grid-template-columns: minmax(7rem, .8fr) minmax(10rem, 1.6fr) minmax(6rem, auto) auto;\n  border: 2px solid var(--edge);\n  background: var(--face);\n  align-items:  center;\n  gap: .5rem .7rem;\n  padding: .5rem .65rem;\n}\n\n.name_y_OAsA {\n  font-family: var(--font-big);\n  color: var(--text);\n  overflow-wrap: anywhere;\n  font-size: .85rem;\n  font-weight: 900;\n}\n\n.command_y_OAsA, .env_y_OAsA, .tested_y_OAsA {\n  font-family: var(--font-mono);\n  color: var(--text-dim);\n  overflow-wrap: anywhere;\n  font-size: .68rem;\n}\n\n.state_y_OAsA {\n  font-family: var(--font-mono);\n  color: var(--text-dim);\n  font-size: .68rem;\n  font-weight: 600;\n}\n\n.good_y_OAsA {\n  font-family: var(--font-mono);\n  color: var(--accent);\n  font-size: .68rem;\n  font-weight: 700;\n}\n\n.env_y_OAsA, .tested_y_OAsA {\n  grid-column: 1 / -1;\n}\n\n.acts_y_OAsA {\n  display: flex;\n  flex-wrap: wrap;\n  gap: .35rem;\n}\n\n.acts_y_OAsA button, .add_y_OAsA, .formActs_y_OAsA button {\n  font-family: var(--font-big);\n  letter-spacing: .08em;\n  text-transform: uppercase;\n  color: var(--text-dim);\n  background: var(--face);\n  border: 2px solid var(--edge);\n  cursor: pointer;\n  padding: .3rem .55rem;\n  font-size: .62rem;\n  font-weight: 800;\n}\n\n.acts_y_OAsA button:hover, .add_y_OAsA:hover, .formActs_y_OAsA button:hover {\n  color: var(--text);\n}\n\n.add_y_OAsA {\n  box-shadow: 3px 3px 0 0 var(--edge);\n  border-width: 3px;\n  align-self:  flex-start;\n}\n\n.form_y_OAsA {\n  display: flex;\n  border: 2px solid var(--edge);\n  background: var(--face);\n  flex-direction: column;\n  gap: .5rem;\n  max-width: 34rem;\n  padding: .7rem;\n}\n\n.form_y_OAsA label {\n  display: flex;\n  font-family: var(--font-big);\n  letter-spacing: .06em;\n  text-transform: uppercase;\n  color: var(--text-dim);\n  flex-direction: column;\n  gap: .2rem;\n  font-size: .66rem;\n  font-weight: 800;\n}\n\n.form_y_OAsA input, .form_y_OAsA textarea {\n  font-family: var(--font-mono);\n  color: var(--text);\n  background: var(--stage-row, var(--panel));\n  border: 2px solid var(--edge);\n  padding: .4rem .5rem;\n  font-size: .72rem;\n}\n\n.formActs_y_OAsA {\n  display: flex;\n  gap: .4rem;\n}\n\n.snippet_y_OAsA {\n  font-family: var(--font-mono);\n  color: var(--text);\n  background: var(--face);\n  border: 2px solid var(--edge);\n  overflow-wrap: anywhere;\n  user-select: all;\n  max-width: 30rem;\n  padding: .45rem .6rem;\n  font-size: .68rem;\n}\n\n.problem_y_OAsA {\n  font-family: var(--font-mono);\n  color: var(--stage-danger-text, var(--text));\n  margin: 0;\n  font-size: .7rem;\n  font-weight: 600;\n}\n\n/* src/ui/apps/settings/sections/models.module.css */\n.list_3-d07w {\n  list-style: none;\n  display: flex;\n  flex-direction: column;\n  gap: .4rem;\n  margin: 0;\n  padding: 0;\n}\n\n.empty_3-d07w {\n  color: var(--muted);\n  padding: .5rem 0;\n  font-style: italic;\n}\n\n.row_3-d07w {\n  display: grid;\n  grid-template-columns: minmax(9rem, 1.4fr) minmax(7rem, 1fr) auto 1fr auto;\n  border: 2px solid var(--edge);\n  background: var(--face);\n  align-items:  center;\n  gap: .6rem;\n  padding: .5rem .65rem;\n}\n\n.rowActive_3-d07w {\n  border-color: var(--rose);\n  background: var(--panel);\n}\n\n.pick_3-d07w {\n  display: flex;\n  cursor: pointer;\n  align-items:  center;\n  gap: .45rem;\n  min-width: 0;\n}\n\n.name_3-d07w {\n  font-family: var(--font-big);\n  color: var(--text);\n  overflow-wrap: anywhere;\n  font-size: .9rem;\n  font-weight: 900;\n}\n\n.model_3-d07w {\n  font-family: var(--font-mono);\n  color: var(--text-dim);\n  overflow-wrap: anywhere;\n  font-size: .72rem;\n}\n\n.key_3-d07w {\n  font-family: var(--font-mono);\n  letter-spacing: .08em;\n  text-transform: uppercase;\n  color: var(--text-dim);\n  font-size: .62rem;\n}\n\n.tested_3-d07w {\n  font-family: var(--font-mono);\n  color: var(--text-dim);\n  overflow-wrap: anywhere;\n  font-size: .68rem;\n}\n\n.acts_3-d07w {\n  display: flex;\n  gap: .3rem;\n}\n\n.acts_3-d07w button, .add_3-d07w, .formActs_3-d07w button {\n  border: 2px solid var(--edge);\n  background: var(--face);\n  color: var(--text);\n  font-family: var(--font-mono);\n  letter-spacing: .06em;\n  cursor: pointer;\n  padding: .28rem .6rem;\n  font-size: .68rem;\n  font-weight: 700;\n}\n\n.acts_3-d07w button:hover:not(:disabled), .add_3-d07w:hover:not(:disabled), .formActs_3-d07w button:hover:not(:disabled) {\n  background: var(--panel);\n}\n\n.acts_3-d07w button:disabled, .add_3-d07w:disabled, .formActs_3-d07w button:disabled {\n  color: var(--text-dim);\n  cursor: not-allowed;\n}\n\n.add_3-d07w {\n  box-shadow: 3px 3px 0 0 var(--edge);\n  align-self:  flex-start;\n  margin-top: .6rem;\n}\n\n.form_3-d07w {\n  display: flex;\n  border: 3px solid var(--edge);\n  box-shadow: 4px 4px 0 0 var(--edge);\n  background: var(--panel);\n  flex-direction: column;\n  gap: .55rem;\n  margin-top: .6rem;\n  padding: .75rem .85rem;\n}\n\n.form_3-d07w label {\n  display: flex;\n  font-family: var(--font-mono);\n  letter-spacing: .1em;\n  text-transform: uppercase;\n  color: var(--text-dim);\n  flex-direction: column;\n  gap: .2rem;\n  font-size: .64rem;\n  font-weight: 700;\n}\n\n.form_3-d07w input, .form_3-d07w select {\n  border: 2px solid var(--edge);\n  background: var(--face);\n  color: var(--text);\n  font-family: var(--font-body);\n  text-transform: none;\n  letter-spacing: normal;\n  padding: .4rem .5rem;\n  font-size: .88rem;\n}\n\n.formActs_3-d07w {\n  display: flex;\n  gap: .4rem;\n}\n\n.notice_3-d07w, .problem_3-d07w {\n  border: 2px solid var(--edge);\n  background: var(--face);\n  color: var(--text);\n  margin: .5rem 0 0;\n  padding: .5rem .65rem;\n  font-size: .82rem;\n}\n\n.problem_3-d07w {\n  border-color: var(--rose);\n}\n\n/* src/ui/apps/settings/sections/remote-access.module.css */\n.wrap_z3r0lA {\n}\n\n.title_z3r0lA {\n}\n\n.blurb_z3r0lA {\n  max-width: 40rem;\n}\n\n.card_z3r0lA {\n}\n\n.hero_z3r0lA {\n}\n\n.cardTitle_z3r0lA {\n}\n\n.cardBody_z3r0lA {\n}\n\n.subtle_z3r0lA {\n}\n\n.actions_z3r0lA {\n}\n\n.btn_z3r0lA {\n}\n\n.btnGhost_z3r0lA {\n}\n\n.btnDanger_z3r0lA {\n}\n\n.status_z3r0lA {\n}\n\n.bad_z3r0lA {\n}\n\n.dot_z3r0lA {\n}\n\n.on_z3r0lA {\n}\n\n.busy_z3r0lA {\n}\n\n.titleRow_z3r0lA {\n  display: flex;\n  justify-content: space-between;\n  align-items:  center;\n  gap: .7rem;\n}\n\n.eyeBtn_z3r0lA {\n  display: inline-flex;\n  color: var(--text-dim);\n  border: 2px solid var(--edge);\n  box-shadow: 3px 3px 0 0 var(--edge);\n  cursor: pointer;\n  background: none;\n  flex: none;\n  justify-content: center;\n  align-items:  center;\n  padding: .32rem;\n}\n\n.eyeBtn_z3r0lA:hover {\n  color: var(--text);\n}\n\n.eyeBtn_z3r0lA[aria-pressed=\"true\"] {\n  color: var(--accent);\n  border-color: var(--accent);\n}\n\n.urlbar_z3r0lA {\n  display: inline-flex;\n  font-family: var(--font-mono);\n  color: var(--accent);\n  border: 2px solid var(--edge);\n  background: var(--shell-panel);\n  word-break: break-all;\n  align-items:  center;\n  gap: .45rem;\n  max-width: 100%;\n  padding: .45rem .7rem;\n  font-size: .78rem;\n  font-weight: 700;\n}\n\n.lock_z3r0lA {\n  color: var(--accent);\n  flex: none;\n}\n\n.note_z3r0lA {\n  font-family: var(--font-mono);\n  color: var(--text-dim);\n  max-width: 42rem;\n  font-size: .68rem;\n  line-height: 1.6;\n}\n\n.devices_z3r0lA {\n  display: flex;\n  border-top: 2px solid var(--seam);\n  flex-direction: column;\n  gap: .4rem;\n  padding-top: .8rem;\n}\n\n.devicesTitle_z3r0lA {\n  font-family: var(--font-big);\n  letter-spacing: .1em;\n  text-transform: uppercase;\n  color: var(--text-dim);\n  font-size: .72rem;\n  font-weight: 800;\n}\n\n.deviceRow_z3r0lA {\n  display: flex;\n  border: 2px solid var(--edge);\n  background: var(--shell-panel);\n  justify-content: space-between;\n  align-items:  center;\n  gap: .7rem;\n  padding: .4rem .6rem;\n}\n\n.deviceName_z3r0lA {\n  font-family: var(--font-mono);\n  color: var(--text);\n  word-break: break-all;\n  font-size: .74rem;\n  font-weight: 600;\n}\n\n.code_z3r0lA {\n  font-family: var(--font-mono);\n  letter-spacing: .22em;\n  text-align: center;\n  color: var(--text);\n  border: 3px solid var(--edge);\n  background: var(--shell-panel);\n  padding: .7rem;\n  font-size: 1.4rem;\n  font-weight: 700;\n}\n\n/* src/ui/apps/settings/sections/engines.module.css */\n.field_30KD9g {\n  display: flex;\n  flex-direction: column;\n  flex: 1;\n  gap: .4rem;\n  min-width: 18rem;\n  max-width: 30rem;\n}\n\n.path_30KD9g {\n  font-family: var(--font-mono);\n  color: var(--text);\n  background: var(--face);\n  border: 3px solid var(--edge);\n  width: 100%;\n  padding: .45rem .6rem;\n  font-size: .72rem;\n}\n\n.path_30KD9g:disabled {\n  color: var(--text-dim);\n  background: none;\n  border-style: dashed;\n}\n\n.acts_30KD9g {\n  display: flex;\n  gap: .4rem;\n}\n\n.acts_30KD9g button {\n  font-family: var(--font-big);\n  letter-spacing: .08em;\n  text-transform: uppercase;\n  color: var(--text-dim);\n  background: var(--face);\n  border: 3px solid var(--edge);\n  box-shadow: 3px 3px 0 0 var(--edge);\n  cursor: pointer;\n  padding: .35rem .7rem;\n  font-size: .6875rem;\n  font-weight: 800;\n}\n\n.acts_30KD9g button:disabled {\n  cursor: default;\n  box-shadow: none;\n  opacity: .55;\n}\n\n.note_30KD9g, .good_30KD9g, .said_30KD9g {\n  font-family: var(--font-mono);\n  overflow-wrap: anywhere;\n  margin: 0;\n  font-size: .68rem;\n  font-weight: 600;\n}\n\n.note_30KD9g {\n  color: var(--text-dim);\n}\n\n.good_30KD9g {\n  color: var(--accent);\n}\n\n.said_30KD9g {\n  color: var(--text-soft, var(--text-dim));\n}\n\n/* src/ui/apps/settings/sections/section-card.module.css */\n.wrap_FL7zVg {\n  display: flex;\n  flex-direction: column;\n  gap: 1.1rem;\n}\n\n.title_FL7zVg {\n  font-family: var(--font-big);\n  color: var(--text);\n  font-size: 1.15rem;\n  font-weight: 800;\n}\n\n.blurb_FL7zVg {\n  font-family: var(--font-mono);\n  color: var(--text-soft, var(--text-dim));\n  max-width: 42rem;\n  margin-top: .35rem;\n  font-size: .76rem;\n  line-height: 1.6;\n}\n\n.card_FL7zVg {\n  background: var(--face);\n  border: 3px solid var(--edge);\n  box-shadow: 6px 6px 0 0 var(--edge);\n  display: flex;\n  flex-direction: column;\n  gap: .9rem;\n  padding: clamp(1rem, 2.5vw, 1.5rem);\n}\n\n.cardHero_FL7zVg {\n  box-shadow: 6px 6px 0 0 var(--accent-deep);\n}\n\n.cardTitle_FL7zVg {\n  font-family: var(--font-big);\n  color: var(--text);\n  font-size: .95rem;\n  font-weight: 800;\n}\n\n.cardBody_FL7zVg {\n  font-family: var(--font-mono);\n  color: var(--text-soft, var(--text-dim));\n  max-width: 42rem;\n  font-size: .74rem;\n  line-height: 1.6;\n}\n\n.cardBody_FL7zVg b {\n  color: var(--text);\n}\n\n.subtle_FL7zVg {\n  font-family: var(--font-mono);\n  color: var(--text-dim);\n  max-width: 42rem;\n  font-size: .68rem;\n  line-height: 1.6;\n}\n\n.actions_FL7zVg {\n  display: flex;\n  flex-wrap: wrap;\n  align-items:  center;\n  gap: .5rem;\n}\n\n.btn_FL7zVg {\n  font-family: var(--font-mono);\n  letter-spacing: .03em;\n  border: 2px solid var(--edge);\n  background: var(--accent);\n  color: #fff;\n  box-shadow: 3px 3px 0 0 var(--edge);\n  cursor: pointer;\n  padding: .5rem 1rem;\n  font-size: .82rem;\n  font-weight: 700;\n}\n\n.btn_FL7zVg:disabled {\n  opacity: .55;\n  cursor: default;\n}\n\n.btnGhost_FL7zVg {\n  font-family: var(--font-mono);\n  letter-spacing: .05em;\n  text-transform: uppercase;\n  color: var(--text-dim);\n  border: 2px dashed var(--text-faint);\n  cursor: pointer;\n  background: none;\n  padding: .42rem .7rem;\n  font-size: .72rem;\n  font-weight: 700;\n}\n\n.btnDanger_FL7zVg {\n  border-style: solid;\n  border-color: var(--stage-danger-edge);\n  color: var(--stage-danger-text);\n}\n\n.status_FL7zVg {\n  display: inline-flex;\n  font-family: var(--font-mono);\n  color: var(--text);\n  align-items:  center;\n  gap: .45rem;\n  font-size: .74rem;\n  font-weight: 600;\n}\n\n.statusBad_FL7zVg {\n  color: var(--stage-danger-text);\n}\n\n.dot_FL7zVg {\n  display: inline-block;\n  background: var(--text-faint);\n  border-radius: 50%;\n  flex: none;\n  width: 8px;\n  height: 8px;\n}\n\n.dotOn_FL7zVg {\n  background: var(--accent);\n}\n\n.dotBusy_FL7zVg {\n  background: var(--accent);\n  animation: pulse 1.1s ease-in-out infinite;\n}\n\n@keyframes pulse_afhCBQ {\n  0%, 100% {\n    opacity: .35;\n  }\n\n  50% {\n    opacity: 1;\n  }\n}\n\n.chip_FL7zVg {\n  display: inline-block;\n  letter-spacing: .08em;\n  text-transform: uppercase;\n  border: 2px solid var(--edge);\n  padding: .08rem .4rem;\n  font-size: .62rem;\n  font-weight: 800;\n}\n\n/* src/ui/apps/settings/sections/updates.module.css */\n.wrap_BHLlhQ {\n}\n\n.title_BHLlhQ {\n}\n\n.blurb_BHLlhQ {\n}\n\n.card_BHLlhQ {\n}\n\n.hero_BHLlhQ {\n}\n\n.cardTitle_BHLlhQ {\n}\n\n.cardBody_BHLlhQ {\n}\n\n.actions_BHLlhQ {\n}\n\n.btn_BHLlhQ {\n}\n\n.btnGhost_BHLlhQ {\n}\n\n.btnDanger_BHLlhQ {\n}\n\n.status_BHLlhQ {\n}\n\n.dot_BHLlhQ {\n}\n\n.busy_BHLlhQ {\n}\n\n.chip_BHLlhQ {\n}\n\n.on_BHLlhQ {\n  background: var(--stage-ok);\n}\n\n.behindWrap_BHLlhQ {\n  display: flex;\n  flex-wrap: wrap;\n  align-items:  center;\n  gap: 1rem;\n}\n\n.behindNum_BHLlhQ {\n  font-family: var(--font-mono);\n  color: var(--stage-warn);\n  border: 3px solid var(--edge);\n  background: var(--shell-panel);\n  padding: .35rem .7rem;\n  font-size: 2.6rem;\n  font-weight: 700;\n  line-height: 1;\n}\n\n.behindText_BHLlhQ {\n  font-family: var(--font-mono);\n  color: var(--text-soft, var(--text-dim));\n  font-size: .82rem;\n}\n\n.behindPair_BHLlhQ {\n  margin-top: .4rem;\n}\n\n.cur_BHLlhQ {\n  color: var(--text);\n  font-weight: 700;\n}\n\n.lat_BHLlhQ {\n  color: var(--stage-ok);\n  font-weight: 700;\n}\n\n.tl_BHLlhQ {\n  display: flex;\n  border-left: 3px solid var(--seam);\n  flex-direction: column;\n  gap: .55rem;\n  margin-left: .5rem;\n}\n\n.ver_BHLlhQ {\n  position: relative;\n  display: flex;\n  border: 2px solid var(--seam);\n  background: var(--shell-panel);\n  border-left: none;\n  align-items:  flex-start;\n  gap: .8rem;\n  margin-left: 1.1rem;\n  padding: .7rem .85rem;\n}\n\n.ver_BHLlhQ:before {\n  content: \"\";\n  position: absolute;\n  background: var(--text-faint);\n  border: 2px solid var(--edge);\n  border-radius: 50%;\n  width: 12px;\n  height: 12px;\n  top: 1rem;\n  left: -1.55rem;\n}\n\n.ver_BHLlhQ.here_BHLlhQ {\n  border-color: var(--accent);\n  box-shadow: 3px 3px 0 0 var(--accent-deep);\n}\n\n.ver_BHLlhQ.here_BHLlhQ:before {\n  background: var(--accent);\n}\n\n.vtag_BHLlhQ {\n  font-family: var(--font-mono);\n  border: 2px solid var(--edge);\n  background: var(--face);\n  text-align: center;\n  color: var(--text);\n  flex: none;\n  min-width: 5.4rem;\n  padding: .15rem .5rem;\n  font-size: .95rem;\n  font-weight: 700;\n}\n\n.ver_BHLlhQ.here_BHLlhQ .vtag_BHLlhQ {\n  background: var(--accent);\n  color: var(--stage-white);\n}\n\n.vbody_BHLlhQ {\n  flex: 1;\n  min-width: 0;\n}\n\n.vact_BHLlhQ {\n  display: flex;\n  flex: none;\n  align-items:  flex-start;\n}\n\n.hereMark_BHLlhQ {\n  font-family: var(--font-mono);\n  letter-spacing: .08em;\n  text-transform: uppercase;\n  color: var(--accent);\n  padding-top: .3rem;\n  font-size: .68rem;\n  font-weight: 700;\n}\n\n.vname_BHLlhQ {\n  display: flex;\n  flex-wrap: wrap;\n  align-items:  center;\n  gap: .5rem;\n}\n\n.cm_BHLlhQ {\n  font-family: var(--font-mono);\n  color: var(--text);\n  word-break: break-word;\n  font-size: .85rem;\n  font-weight: 600;\n}\n\n.vmeta_BHLlhQ {\n  color: var(--text-dim);\n  font-size: .72rem;\n  font-family: var(--font-mono);\n  display: flex;\n  flex-wrap: wrap;\n  align-items:  center;\n  gap: .4rem;\n  margin-top: .25rem;\n}\n\n.rel_BHLlhQ {\n  font-weight: 700;\n}\n\n.rel_BHLlhQ.ahead_BHLlhQ {\n  color: var(--stage-ok);\n}\n\n.rel_BHLlhQ.behind_BHLlhQ {\n  color: var(--stage-warn);\n}\n\n.rel_BHLlhQ.here_BHLlhQ {\n  color: var(--accent);\n}\n\n.chipNow_BHLlhQ {\n  background: var(--accent);\n  color: var(--stage-white);\n}\n\n.caret_BHLlhQ {\n  cursor: pointer;\n  color: var(--text-soft, var(--text-dim));\n  font-family: var(--font-mono);\n  text-align: left;\n  background: none;\n  border: none;\n  padding: .4rem 0 0;\n  font-size: .72rem;\n}\n\n.caret_BHLlhQ:hover {\n  color: var(--text);\n}\n\n.noLog_BHLlhQ {\n  color: var(--text-faint);\n  font-family: var(--font-mono);\n  margin-top: .4rem;\n  font-size: .72rem;\n}\n\n.log_BHLlhQ {\n  border-top: 2px solid var(--seam);\n  display: flex;\n  flex-direction: column;\n  gap: .15rem;\n  margin-top: .6rem;\n  padding-top: .55rem;\n}\n\n.c_BHLlhQ {\n  display: flex;\n  font-family: var(--font-mono);\n  color: var(--text-soft, var(--text-dim));\n  gap: .6rem;\n  font-size: .72rem;\n}\n\n.c_BHLlhQ .h_BHLlhQ {\n  color: var(--accent);\n  flex: none;\n}\n\n.c_BHLlhQ .s_BHLlhQ {\n  color: var(--text);\n  word-break: break-word;\n}\n\n.overlay_BHLlhQ {\n  position: fixed;\n  display: flex;\n  z-index: 50;\n  background: #0000008c;\n  justify-content: center;\n  align-items:  center;\n  padding: 1.5rem;\n  inset: 0;\n}\n\n.popup_BHLlhQ {\n  background: var(--face);\n  border: 3px solid var(--edge);\n  box-shadow: 6px 6px 0 0 var(--accent-deep);\n  display: flex;\n  text-align: center;\n  flex-direction: column;\n  gap: .7rem;\n  width: 100%;\n  max-width: 24rem;\n  padding: 1.4rem;\n}\n\n.jump_BHLlhQ {\n  font-family: var(--font-mono);\n  color: var(--text);\n  font-size: 1rem;\n  font-weight: 700;\n}\n\n.arrow_BHLlhQ {\n  color: var(--accent);\n}\n\n.warnNote_BHLlhQ {\n  border: 2px solid var(--stage-warn);\n  background: var(--stage-warn-ink, var(--shell-panel));\n  color: var(--text);\n  font-family: var(--font-mono);\n  text-align: left;\n  padding: .6rem .75rem;\n  font-size: .74rem;\n  line-height: 1.5;\n}\n\n.badge_BHLlhQ {\n  border: 3px solid var(--edge);\n  display: inline-flex;\n  justify-content: center;\n  align-self:  center;\n  align-items:  center;\n  width: 48px;\n  height: 48px;\n}\n\n.badgeOk_BHLlhQ {\n  background: var(--stage-ok);\n  color: var(--stage-black, var(--edge));\n}\n\n.badgeBad_BHLlhQ {\n  background: var(--accent-deep);\n  color: var(--stage-white);\n}\n\n.big_BHLlhQ {\n  font-family: var(--font-big);\n  color: var(--text);\n  font-size: 1.15rem;\n  font-weight: 800;\n}\n\n.sub_BHLlhQ {\n  font-family: var(--font-mono);\n  color: var(--text-soft, var(--text-dim));\n  font-size: .8rem;\n  line-height: 1.5;\n}\n\n.actionsCenter_BHLlhQ {\n  display: flex;\n  flex-wrap: wrap;\n  justify-content: center;\n  align-items:  center;\n  gap: .5rem;\n}\n";document.head.append(s);}
// src/ui/apps/settings/index.tsx
import { useEffect as useEffect12, useState as useState15 } from "react";

// src/ui/_shared/launch-target.ts
var SAFE_ID = /^[a-z0-9][a-z0-9-]*$/;
function parseLaunchTarget(hash) {
  const parts = hash.replace(/^#/, "").split("/").filter(Boolean);
  if (parts.length < 1 || parts.length > 2 || parts.some((part) => !SAFE_ID.test(part))) {
    return null;
  }
  return {
    appId: parts[0],
    ...parts[1] ? { sectionId: parts[1] } : {}
  };
}

// src/ui/apps/settings/sections/about.tsx
import { useEffect, useRef, useState } from "react";

// src/ui/_shared/external-url.ts
var safeExternalUrl = (input) => {
  let u;
  try {
    u = new URL(input.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:")
    return null;
  return u.href;
};
var hostFromText = (text) => {
  const t = text.trim();
  if (t === "" || /\s/.test(t))
    return null;
  const candidate = /^https?:\/\//i.test(t) ? t : `http://${t}`;
  try {
    const host = new URL(candidate).host.toLowerCase();
    return host.includes(".") ? host : null;
  } catch {
    return null;
  }
};
var externalLinkInfo = (href, text) => {
  const url = safeExternalUrl(href);
  if (url === null)
    return null;
  const host = new URL(url).host;
  const named = hostFromText(text);
  return { url, host, mismatch: named !== null && named !== host.toLowerCase() };
};

// src/ui/_shared/link-gate.ts
var EVENT = "vaude:external-link";
var requestExternal = (href, text) => {
  const info = externalLinkInfo(href, text);
  if (info === null)
    return false;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: info }));
  return true;
};

// src/ui/_shared/update-check.ts
var RELEASES_PAGE = "https://github.com/Coneja-Chibi/Hoplight/releases";
var isRec = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
function readLatestRelease(json) {
  if (!isRec(json) || typeof json.tag_name !== "string" || json.tag_name === "")
    return null;
  const url = typeof json.html_url === "string" && json.html_url ? json.html_url : RELEASES_PAGE;
  return { version: json.tag_name, url };
}
function compareVersions(a, b) {
  const parse = (v) => {
    const clean = v.trim().replace(/^v/i, "");
    const dash = clean.indexOf("-");
    const core = dash >= 0 ? clean.slice(0, dash) : clean;
    const pre = dash >= 0 ? clean.slice(dash + 1) : "";
    const nums = core.split(".").map((s) => {
      const n = Number.parseInt(s, 10);
      return Number.isFinite(n) ? n : 0;
    });
    return { nums, pre };
  };
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0;i < Math.max(pa.nums.length, pb.nums.length); i++) {
    const na = pa.nums[i] ?? 0;
    const nb = pb.nums[i] ?? 0;
    if (na !== nb)
      return na < nb ? -1 : 1;
  }
  if (pa.pre !== pb.pre) {
    if (pa.pre === "")
      return 1;
    if (pb.pre === "")
      return -1;
    return pa.pre < pb.pre ? -1 : 1;
  }
  return 0;
}
function updateStatusOf(installed, httpStatus, body) {
  if (httpStatus === 0)
    return { state: "error", message: "Could not reach GitHub." };
  if (httpStatus === 404)
    return { state: "none" };
  if (httpStatus !== 200)
    return { state: "error", message: `GitHub answered ${httpStatus}.` };
  const latest = readLatestRelease(body);
  if (!latest)
    return { state: "error", message: "GitHub's answer was not a release." };
  return compareVersions(installed, latest.version) < 0 ? { state: "available", installed, latest } : { state: "current", installed };
}

// src/ui/_shared/web-storage.ts
var volatile = new Map;
function webStorage(area) {
  const transient = volatile.get(area);
  if (transient)
    return transient;
  if (typeof globalThis === "undefined")
    return null;
  try {
    return area === "local" ? globalThis.localStorage : globalThis.sessionStorage;
  } catch {
    return null;
  }
}

// src/ui/_shared/window-memory.ts
var ACTIVE_APP_KEY = "vaude.session.activeApp";
var TRANSCRIPT_KEY = "hoplight.agent.transcript";
var PANEL_KEY = "hoplight.agent.panel";
var AGENT_SESSION_KEY = "hoplight.agent.session";
var QUEUE_KEY = "hoplight.agent.queue";
var RESET_KEYS = [
  { key: ACTIVE_APP_KEY, where: "session" },
  { key: TRANSCRIPT_KEY, where: "session" },
  { key: AGENT_SESSION_KEY, where: "session" },
  { key: QUEUE_KEY, where: "session" },
  { key: PANEL_KEY, where: "local" }
];
function clearWindowMemory() {
  for (const entry of RESET_KEYS) {
    try {
      webStorage(entry.where)?.removeItem(entry.key);
    } catch {}
  }
}

// src/ui/apps/settings/styles.module.css
var styles_module_default = {
  roomHost: "roomHost_6FRrQA",
  room: "room_6FRrQA",
  tabs: "tabs_6FRrQA",
  tab: "tab_6FRrQA",
  on: "on_6FRrQA",
  body: "body_6FRrQA",
  row: "row_6FRrQA",
  tx: "tx_6FRrQA",
  label: "label_6FRrQA",
  hint: "hint_6FRrQA",
  statusNote: "statusNote_6FRrQA",
  seg: "seg_6FRrQA",
  plates: "plates_6FRrQA",
  plate: "plate_6FRrQA",
  plateDanger: "plateDanger_6FRrQA",
  pathNote: "pathNote_6FRrQA"
};

// src/ui/apps/settings/section-contract.tsx
import { jsxDEV } from "react/jsx-dev-runtime";
function SettingsRow({ label, hint, children }) {
  return /* @__PURE__ */ jsxDEV("div", {
    className: styles_module_default.row,
    children: [
      /* @__PURE__ */ jsxDEV("div", {
        className: styles_module_default.tx,
        children: [
          /* @__PURE__ */ jsxDEV("div", {
            className: styles_module_default.label,
            children: label
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV("div", {
            className: styles_module_default.hint,
            children: hint
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      children
    ]
  }, undefined, true, undefined, this);
}
function SegControl({
  options,
  current,
  onPick
}) {
  return /* @__PURE__ */ jsxDEV("div", {
    className: styles_module_default.seg,
    children: options.map((opt) => /* @__PURE__ */ jsxDEV("button", {
      type: "button",
      className: opt.value === current ? styles_module_default.on : undefined,
      onClick: () => onPick(opt.value),
      children: opt.label
    }, opt.value, false, undefined, this))
  }, undefined, false, undefined, this);
}

// src/ui/apps/settings/sections/about.tsx
import { jsxDEV as jsxDEV2, Fragment } from "react/jsx-dev-runtime";
var REPO_PAGE = "https://github.com/Coneja-Chibi/Hoplight";
var RELEASES_PAGE2 = "https://github.com/Coneja-Chibi/Hoplight/releases";
function AboutSection({ ctx }) {
  const [installed, setInstalled] = useState("");
  const [studioDir, setStudioDir] = useState("");
  const [mode, setMode] = useState("packaged");
  const [status, setStatus] = useState({
    state: "idle"
  });
  useEffect(() => {
    let cancelled = false;
    ctx.api.version().then((v) => {
      if (cancelled)
        return;
      setInstalled(v.version);
      if (typeof v.studioDir === "string")
        setStudioDir(v.studioDir);
      if (v.mode === "source" || v.mode === "browser")
        setMode(v.mode);
    }).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [ctx]);
  const check = async () => {
    setStatus({ state: "checking" });
    try {
      const { httpStatus, body } = await ctx.api.updateCheck();
      setStatus(updateStatusOf(installed, httpStatus, body));
    } catch {
      setStatus({ state: "error", message: "Could not reach GitHub." });
    }
  };
  const line = status.state === "checking" ? "Asking GitHub..." : status.state === "current" ? "You are on the newest release." : status.state === "available" ? mode === "source" ? `${status.latest.version} is out. Your checkout updates with: git pull (then bun install).` : mode === "browser" ? `${status.latest.version} is out. Reload this page after the hosted build updates.` : `${status.latest.version} is out.` : status.state === "none" ? "No published releases yet." : status.state === "error" ? status.message : "";
  return /* @__PURE__ */ jsxDEV2(Fragment, {
    children: [
      /* @__PURE__ */ jsxDEV2(SettingsRow, {
        label: "Updates",
        hint: mode === "browser" ? `Version ${installed || "?"}, temporary browser studio. The hosted build updates when Hoplight deploys it.` : `Version ${installed || "?"}, ${mode === "source" ? "running from source" : "installed app"}. Checks GitHub only when you press the button; nothing runs on its own.`,
        children: /* @__PURE__ */ jsxDEV2("div", {
          className: styles_module_default.plates,
          children: [
            mode === "browser" ? /* @__PURE__ */ jsxDEV2("span", {
              className: styles_module_default.statusNote,
              children: "Reload after a new hosted version is deployed."
            }, undefined, false, undefined, this) : /* @__PURE__ */ jsxDEV2("button", {
              type: "button",
              className: styles_module_default.plate,
              disabled: status.state === "checking",
              onClick: () => void check(),
              children: "Check for updates"
            }, undefined, false, undefined, this),
            status.state === "available" && /* @__PURE__ */ jsxDEV2("button", {
              type: "button",
              className: mode === "source" ? styles_module_default.plate : `${styles_module_default.plate} ${styles_module_default.on}`,
              onClick: () => requestExternal(status.latest.url, "GitHub release"),
              children: "View release"
            }, undefined, false, undefined, this),
            line && /* @__PURE__ */ jsxDEV2("span", {
              role: "status",
              className: styles_module_default.statusNote,
              children: line
            }, undefined, false, undefined, this)
          ]
        }, undefined, true, undefined, this)
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV2(SettingsRow, {
        label: "Your studio folder",
        hint: mode === "browser" ? "This studio exists only in this page. Export work before reloading or closing it." : "Every piece is a plain JSON file here. Back this folder up and you have backed up everything.",
        children: /* @__PURE__ */ jsxDEV2("span", {
          className: styles_module_default.pathNote,
          children: mode === "browser" ? "Tab memory only" : studioDir || "(shown once the studio answers)"
        }, undefined, false, undefined, this)
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV2(SettingsRow, {
        label: "Project",
        hint: "Open source under AGPL-3.0. Bugs and wishes welcome.",
        children: /* @__PURE__ */ jsxDEV2("div", {
          className: styles_module_default.plates,
          children: [
            /* @__PURE__ */ jsxDEV2("button", {
              type: "button",
              className: styles_module_default.plate,
              onClick: () => requestExternal(REPO_PAGE, "Hoplight on GitHub"),
              children: "GitHub"
            }, undefined, false, undefined, this),
            /* @__PURE__ */ jsxDEV2("button", {
              type: "button",
              className: styles_module_default.plate,
              onClick: () => requestExternal(RELEASES_PAGE2, "Hoplight releases"),
              children: "Releases"
            }, undefined, false, undefined, this)
          ]
        }, undefined, true, undefined, this)
      }, undefined, false, undefined, this),
      mode !== "browser" && /* @__PURE__ */ jsxDEV2(LifecycleRow, {
        ctx
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
function LifecycleRow({ ctx }) {
  const [armed, setArmed] = useState(null);
  const [phase, setPhase] = useState("idle");
  const disarmTimer = useRef(null);
  const arm = (which) => {
    setArmed(which);
    if (disarmTimer.current)
      clearTimeout(disarmTimer.current);
    disarmTimer.current = setTimeout(() => setArmed(null), 4000);
  };
  const doRestart = async () => {
    setPhase("restarting");
    try {
      await ctx.api.restartApp();
    } catch {}
    const started = Date.now();
    const poll = async () => {
      if (Date.now() - started > 20000) {
        setPhase("idle");
        ctx.setStatus("the studio did not come back; start it from your shortcut");
        return;
      }
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (res.ok) {
          location.reload();
          return;
        }
      } catch {}
      setTimeout(() => void poll(), 700);
    };
    setTimeout(() => void poll(), 1200);
  };
  const doQuit = async () => {
    setPhase("closed");
    try {
      await ctx.api.shutdownApp();
    } catch {}
  };
  if (phase === "restarting") {
    return /* @__PURE__ */ jsxDEV2(SettingsRow, {
      label: "The app",
      hint: "Restarting. This page reconnects by itself.",
      children: /* @__PURE__ */ jsxDEV2("span", {
        role: "status",
        className: styles_module_default.statusNote,
        children: "Waiting for the studio to come back..."
      }, undefined, false, undefined, this)
    }, undefined, false, undefined, this);
  }
  if (phase === "closed") {
    return /* @__PURE__ */ jsxDEV2(SettingsRow, {
      label: "The app",
      hint: "Hoplight is closed.",
      children: /* @__PURE__ */ jsxDEV2("span", {
        role: "status",
        className: styles_module_default.statusNote,
        children: "You can close this tab. Start it again from your shortcut."
      }, undefined, false, undefined, this)
    }, undefined, false, undefined, this);
  }
  return /* @__PURE__ */ jsxDEV2(SettingsRow, {
    label: "The app",
    hint: "Restart relaunches the studio in place; Quit stops it fully (browser tabs stop working until you start it again). Unsaved edits on the Workbench are lost either way. Reset this window forgets only what this page remembers - the app you were on, the agent conversation, the overlay's position - and never touches your studio, your tabs or your settings.",
    children: /* @__PURE__ */ jsxDEV2("div", {
      className: styles_module_default.plates,
      children: [
        /* @__PURE__ */ jsxDEV2("button", {
          type: "button",
          className: armed === "restart" ? `${styles_module_default.plate} ${styles_module_default.on}` : styles_module_default.plate,
          onClick: () => armed === "restart" ? void doRestart() : arm("restart"),
          children: armed === "restart" ? "Really restart?" : "Restart Hoplight"
        }, undefined, false, undefined, this),
        /* @__PURE__ */ jsxDEV2("button", {
          type: "button",
          className: armed === "quit" ? `${styles_module_default.plate} ${styles_module_default.plateDanger}` : styles_module_default.plate,
          onClick: () => armed === "quit" ? void doQuit() : arm("quit"),
          children: armed === "quit" ? "Really quit?" : "Quit Hoplight"
        }, undefined, false, undefined, this),
        /* @__PURE__ */ jsxDEV2("button", {
          type: "button",
          className: styles_module_default.plate,
          title: "Forget the app you were on, the agent conversation, and where you put the overlay. Your tabs, settings and studio are untouched.",
          onClick: () => {
            clearWindowMemory();
            location.reload();
          },
          children: "Reset this window"
        }, undefined, false, undefined, this)
      ]
    }, undefined, true, undefined, this)
  }, undefined, false, undefined, this);
}
var section = {
  id: "about",
  label: "About",
  order: 90,
  Component: AboutSection
};
var about_default = section;

// src/ui/apps/settings/sections/appearance.tsx
import { useState as useState5 } from "react";

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

// src/ui/components/swatch-row/index.tsx
import { useState as useState4 } from "react";

// src/ui/components/paint-picker/index.tsx
import { useState as useState3 } from "react";

// src/ui/components/color-picker/index.tsx
import { useEffect as useEffect2, useRef as useRef2, useState as useState2 } from "react";

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
  const [hsv, setHsv] = useState2(() => hexToHsv(value ?? "var(--rose)"));
  const [hexDraft, setHexDraft] = useState2(() => hsvToHex(hsv));
  const hexFocused = useRef2(false);
  const hsvRef = useRef2(hsv);
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
  const [sel, setSel] = useState3(0);
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

// src/ui/components/swatch-row/styles.module.css
var styles_module_default4 = {
  wrap: "wrap_OmPbpg",
  row: "row_OmPbpg",
  sw: "sw_OmPbpg",
  on: "on_OmPbpg",
  lbl: "lbl_OmPbpg",
  custom: "custom_OmPbpg",
  empty: "empty_OmPbpg",
  panel: "panel_OmPbpg"
};

// src/ui/components/swatch-row/index.tsx
import { jsxDEV as jsxDEV5 } from "react/jsx-dev-runtime";
var HOUSE_PALETTE = [
  { id: "rose", label: "rose", hex: "var(--rose)" },
  { id: "amber", label: "amber", hex: "#f59e0b" },
  { id: "emerald", label: "emerald", hex: "#10b981" },
  { id: "violet", label: "violet", hex: "#8b5cf6" },
  { id: "blue", label: "blue", hex: "#3b82f6" }
];
var eq = (a, b) => a.toLowerCase() === b.toLowerCase();
function SwatchRow({ palette, value, onChange, allowCustom }) {
  const [open, setOpen] = useState4(false);
  const current = value ?? palette[0]?.hex ?? "var(--rose)";
  const isCustom = !palette.some((c) => eq(c.hex, current));
  return /* @__PURE__ */ jsxDEV5("div", {
    className: styles_module_default4.wrap,
    children: [
      /* @__PURE__ */ jsxDEV5("div", {
        className: styles_module_default4.row,
        children: [
          palette.map((choice) => /* @__PURE__ */ jsxDEV5("button", {
            type: "button",
            className: eq(choice.hex, current) ? `${styles_module_default4.sw} ${styles_module_default4.on}` : styles_module_default4.sw,
            style: { background: choice.hex },
            title: choice.label,
            "aria-pressed": eq(choice.hex, current),
            onClick: () => onChange(choice.hex),
            children: /* @__PURE__ */ jsxDEV5("span", {
              className: styles_module_default4.lbl,
              children: choice.label
            }, undefined, false, undefined, this)
          }, choice.id, false, undefined, this)),
          allowCustom && /* @__PURE__ */ jsxDEV5("button", {
            type: "button",
            className: `${styles_module_default4.sw} ${styles_module_default4.custom} ${isCustom ? styles_module_default4.on : styles_module_default4.empty}`,
            style: isCustom ? { background: current } : undefined,
            title: "Custom color",
            "aria-pressed": isCustom,
            onClick: () => setOpen((o) => !o),
            children: /* @__PURE__ */ jsxDEV5("span", {
              className: styles_module_default4.lbl,
              children: "custom"
            }, undefined, false, undefined, this)
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      allowCustom && open && /* @__PURE__ */ jsxDEV5("div", {
        className: styles_module_default4.panel,
        children: /* @__PURE__ */ jsxDEV5(PaintPicker, {
          value: solidPaint(current),
          allow: ["solid"],
          onChange: (p) => {
            if (p.kind !== "solid")
              return;
            onChange(p.color);
          }
        }, undefined, false, undefined, this)
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}

// src/ui/apps/settings/sections/appearance.tsx
import { jsxDEV as jsxDEV6, Fragment as Fragment2 } from "react/jsx-dev-runtime";
function AppearanceSection({ ctx }) {
  const [theme, setTheme] = useState5(() => ctx.prefs.get(SETTING_KEYS.theme) === "stage" ? "stage" : "paper");
  const [accent, setAccent] = useState5(() => {
    const a = ctx.prefs.get(SETTING_KEYS.houseAccent);
    return typeof a === "string" ? a : undefined;
  });
  return /* @__PURE__ */ jsxDEV6(Fragment2, {
    children: [
      /* @__PURE__ */ jsxDEV6(SettingsRow, {
        label: "Theme",
        hint: "Light paper or the dark forge. Flips instantly.",
        children: /* @__PURE__ */ jsxDEV6(SegControl, {
          options: [
            { value: "paper", label: "Light" },
            { value: "stage", label: "Dark" }
          ],
          current: theme,
          onPick: (v) => {
            ctx.prefs.set(SETTING_KEYS.theme, v);
            setTheme(v);
          }
        }, undefined, false, undefined, this)
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV6(SettingsRow, {
        label: "Your color",
        hint: "The workspace accent. The brand rose never changes.",
        children: /* @__PURE__ */ jsxDEV6(SwatchRow, {
          palette: HOUSE_PALETTE,
          value: accent,
          allowCustom: true,
          onChange: (hex) => {
            ctx.prefs.set(SETTING_KEYS.houseAccent, hex);
            setAccent(hex);
          }
        }, undefined, false, undefined, this)
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
var section2 = {
  id: "appearance",
  label: "Appearance",
  order: 10,
  Component: AppearanceSection
};
var appearance_default = section2;

// src/ui/apps/settings/sections/connections.tsx
import { useCallback, useEffect as useEffect3, useState as useState6 } from "react";

// src/ui/_shared/session-marker.ts
var STALE_SESSION = "stale session";

// src/ui/_shared/api-fetch.ts
class ApiHttpError extends Error {
  status;
  constructor(status, message) {
    super(message);
    this.name = "ApiHttpError";
    this.status = status;
  }
}
var apiStatusIs = (error, status) => typeof error === "object" && error !== null && error.status === status;
var INSPECT_BODY_MAX_BYTES = 64 * 1024 * 1024;
var TOKEN_META = 'meta[name="vaude-session"]';
function readSessionToken(doc = document) {
  const el = doc.querySelector(TOKEN_META);
  const t = el?.getAttribute("content")?.trim() ?? "";
  return t;
}
async function apiFetch(path, init = {}) {
  const headers = { ...init.headers ?? {} };
  const requireToken = init.requireToken ?? (init.method !== undefined && init.method !== "GET");
  if (requireToken) {
    const token = readSessionToken();
    if (!token)
      throw new ApiHttpError(403, "missing session");
    headers["X-Hoplight-Token"] = token;
  }
  const { requireToken: _r, headers: _h, ...rest } = init;
  const res = await fetch(path, { ...rest, headers });
  return res;
}
async function apiFetchJson(path, init = {}) {
  const res = await apiFetch(path, init);
  const text = await res.text();
  let body = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!res.ok) {
    const msg = body && typeof body === "object" && typeof body.error === "string" ? body.error : `request failed (${res.status})`;
    if (res.status === 403 && msg === STALE_SESSION)
      reloadForNewSession();
    throw new ApiHttpError(res.status, msg);
  }
  return body;
}
var reloading = false;
function reloadForNewSession() {
  if (reloading)
    return;
  reloading = true;
  location.reload();
}

// src/ui/apps/settings/sections/connections.module.css
var connections_module_default = {
  list: "list_y_OAsA",
  empty: "empty_y_OAsA",
  row: "row_y_OAsA",
  name: "name_y_OAsA",
  command: "command_y_OAsA",
  env: "env_y_OAsA",
  tested: "tested_y_OAsA",
  state: "state_y_OAsA",
  good: "good_y_OAsA",
  acts: "acts_y_OAsA",
  add: "add_y_OAsA",
  formActs: "formActs_y_OAsA",
  form: "form_y_OAsA",
  snippet: "snippet_y_OAsA",
  problem: "problem_y_OAsA"
};

// src/ui/apps/settings/sections/connections.tsx
import { jsxDEV as jsxDEV7, Fragment as Fragment3 } from "react/jsx-dev-runtime";
var emptyDraft = { id: "", command: "", args: "", env: "" };
function parseEnvLines(text) {
  const env = {};
  for (const raw of text.split(`
`)) {
    const line = raw.trim();
    if (!line)
      continue;
    const cut = line.indexOf("=");
    if (cut <= 0)
      return { bad: line };
    env[line.slice(0, cut).trim()] = line.slice(cut + 1);
  }
  return { env };
}
function ConnectionsSection() {
  const [rows, setRows] = useState6([]);
  const [rejected, setRejected] = useState6([]);
  const [draft, setDraft] = useState6(null);
  const [editingExisting, setEditingExisting] = useState6(false);
  const [busy, setBusy] = useState6(false);
  const [problem, setProblem] = useState6(null);
  const [tested, setTested] = useState6({});
  const [studioDir, setStudioDir] = useState6("");
  const take = useCallback((reply) => {
    setRows(reply.servers);
    setRejected(reply.rejected);
  }, []);
  useEffect3(() => {
    (async () => {
      try {
        take(await apiFetchJson("/api/mcp/servers"));
      } catch (error) {
        setProblem(error instanceof Error ? error.message : "could not read the server list");
      }
      try {
        const v = await apiFetchJson("/api/version");
        setStudioDir(v.studioDir ?? "");
      } catch {}
    })();
  }, [take]);
  const post = async (path, body, then) => {
    setBusy(true);
    setProblem(null);
    try {
      take(await apiFetchJson(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      }));
      if (then !== undefined)
        setProblem(null);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "that did not work");
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    if (!draft)
      return;
    const env = parseEnvLines(draft.env);
    if ("bad" in env) {
      setProblem(`env lines are KEY=VALUE; "${env.bad}" is not`);
      return;
    }
    const body = {
      id: draft.id.trim(),
      command: draft.command.trim(),
      args: draft.args.split(/\s+/).filter(Boolean),
      enabled: true
    };
    if (draft.env.trim() !== "" || !editingExisting)
      body["env"] = "bad" in env ? {} : env.env;
    await post("/api/mcp/servers", body);
    setDraft(null);
  };
  const test = async (id) => {
    setTested((prior) => ({ ...prior, [id]: "spawning..." }));
    try {
      const reply = await apiFetchJson("/api/mcp/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
      setTested((prior) => ({
        ...prior,
        [id]: reply.ok ? `${reply.tools} tool(s)${reply.dropped > 0 ? `, ${reply.dropped} malformed` : ""}` : reply.detail ?? "could not connect"
      }));
    } catch (error) {
      setTested((prior) => ({ ...prior, [id]: error instanceof Error ? error.message : "no answer" }));
    }
  };
  const serveSnippet = `claude mcp add hoplight -- hoplight mcp "${studioDir || "<your studio folder>"}"`;
  return /* @__PURE__ */ jsxDEV7(Fragment3, {
    children: [
      /* @__PURE__ */ jsxDEV7(SettingsRow, {
        label: "MCP servers",
        hint: "Programs this machine runs so their tools join Kit's belt. Every external tool asks at the Gate before it runs.",
        children: /* @__PURE__ */ jsxDEV7("span", {}, undefined, false, undefined, this)
      }, undefined, false, undefined, this),
      rejected.map((line) => /* @__PURE__ */ jsxDEV7("p", {
        className: connections_module_default.problem,
        children: line
      }, line, false, undefined, this)),
      /* @__PURE__ */ jsxDEV7("ul", {
        className: connections_module_default.list,
        children: [
          rows.length === 0 && /* @__PURE__ */ jsxDEV7("li", {
            className: connections_module_default.empty,
            children: "No servers connected yet."
          }, undefined, false, undefined, this),
          rows.map((row) => /* @__PURE__ */ jsxDEV7("li", {
            className: connections_module_default.row,
            children: [
              /* @__PURE__ */ jsxDEV7("span", {
                className: connections_module_default.name,
                children: row.id
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV7("span", {
                className: connections_module_default.command,
                children: [row.command, ...row.args].join(" ")
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV7("span", {
                className: row.status?.state === "connected" ? connections_module_default.good : connections_module_default.state,
                children: !row.enabled ? "off" : row.status?.state === "connected" ? `${row.status.tools} tool(s)` : row.status?.detail ?? "not connected"
              }, undefined, false, undefined, this),
              row.envKeys.length > 0 && /* @__PURE__ */ jsxDEV7("span", {
                className: connections_module_default.env,
                children: `env: ${row.envKeys.join(", ")}`
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV7("span", {
                className: connections_module_default.acts,
                children: [
                  /* @__PURE__ */ jsxDEV7("button", {
                    type: "button",
                    disabled: busy,
                    onClick: () => {
                      test(row.id);
                    },
                    children: "Test"
                  }, undefined, false, undefined, this),
                  /* @__PURE__ */ jsxDEV7("button", {
                    type: "button",
                    disabled: busy,
                    onClick: () => {
                      post("/api/mcp/servers", {
                        id: row.id,
                        command: row.command,
                        args: row.args,
                        enabled: !row.enabled
                      });
                    },
                    children: row.enabled ? "Disable" : "Enable"
                  }, undefined, false, undefined, this),
                  /* @__PURE__ */ jsxDEV7("button", {
                    type: "button",
                    disabled: busy,
                    onClick: () => {
                      setEditingExisting(true);
                      setDraft({ id: row.id, command: row.command, args: row.args.join(" "), env: "" });
                    },
                    children: "Edit"
                  }, undefined, false, undefined, this),
                  /* @__PURE__ */ jsxDEV7("button", {
                    type: "button",
                    disabled: busy,
                    onClick: () => {
                      post("/api/mcp/servers/remove", { id: row.id });
                    },
                    children: "Remove"
                  }, undefined, false, undefined, this)
                ]
              }, undefined, true, undefined, this),
              tested[row.id] && /* @__PURE__ */ jsxDEV7("span", {
                className: connections_module_default.tested,
                children: tested[row.id]
              }, undefined, false, undefined, this)
            ]
          }, row.id, true, undefined, this))
        ]
      }, undefined, true, undefined, this),
      draft === null ? /* @__PURE__ */ jsxDEV7("button", {
        type: "button",
        className: connections_module_default.add,
        disabled: busy,
        onClick: () => {
          setEditingExisting(false);
          setDraft(emptyDraft);
        },
        children: "Add a server"
      }, undefined, false, undefined, this) : /* @__PURE__ */ jsxDEV7("div", {
        className: connections_module_default.form,
        children: [
          /* @__PURE__ */ jsxDEV7("label", {
            children: [
              "Name",
              /* @__PURE__ */ jsxDEV7("input", {
                value: draft.id,
                placeholder: "lumi-tools",
                disabled: editingExisting,
                onChange: (e) => {
                  setDraft({ ...draft, id: e.target.value });
                }
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ jsxDEV7("label", {
            children: [
              "Command",
              /* @__PURE__ */ jsxDEV7("input", {
                value: draft.command,
                placeholder: "C:\\\\path\\\\to\\\\server.exe or uvx",
                onChange: (e) => {
                  setDraft({ ...draft, command: e.target.value });
                }
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ jsxDEV7("label", {
            children: [
              "Arguments",
              /* @__PURE__ */ jsxDEV7("input", {
                value: draft.args,
                placeholder: "--from git+https://... server-cmd",
                onChange: (e) => {
                  setDraft({ ...draft, args: e.target.value });
                }
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ jsxDEV7("label", {
            children: [
              "Environment (KEY=VALUE per line)",
              /* @__PURE__ */ jsxDEV7("textarea", {
                value: draft.env,
                rows: 3,
                spellCheck: false,
                placeholder: editingExisting ? "leave blank to keep the saved values" : "API_KEY=...",
                onChange: (e) => {
                  setDraft({ ...draft, env: e.target.value });
                }
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ jsxDEV7("div", {
            className: connections_module_default.formActs,
            children: [
              /* @__PURE__ */ jsxDEV7("button", {
                type: "button",
                disabled: busy,
                onClick: () => {
                  save();
                },
                children: "Save"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV7("button", {
                type: "button",
                disabled: busy,
                onClick: () => {
                  setDraft(null);
                  setProblem(null);
                },
                children: "Cancel"
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV7(SettingsRow, {
        label: "Hoplight as a server",
        hint: "Point any MCP client at Hoplight's own belt: the library, catalogs and renderers. Your client asks before each tool runs.",
        children: /* @__PURE__ */ jsxDEV7("code", {
          className: connections_module_default.snippet,
          children: serveSnippet
        }, undefined, false, undefined, this)
      }, undefined, false, undefined, this),
      problem !== null && /* @__PURE__ */ jsxDEV7("p", {
        className: connections_module_default.problem,
        children: problem
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
var section3 = {
  id: "connections",
  label: "Connections",
  order: 16,
  Component: ConnectionsSection
};
var connections_default = section3;

// src/ui/apps/settings/sections/models.tsx
import { useCallback as useCallback2, useEffect as useEffect4, useState as useState7 } from "react";

// src/ui/apps/settings/sections/models.module.css
var models_module_default = {
  list: "list_3-d07w",
  empty: "empty_3-d07w",
  row: "row_3-d07w",
  rowActive: "rowActive_3-d07w",
  pick: "pick_3-d07w",
  name: "name_3-d07w",
  model: "model_3-d07w",
  key: "key_3-d07w",
  tested: "tested_3-d07w",
  acts: "acts_3-d07w",
  add: "add_3-d07w",
  formActs: "formActs_3-d07w",
  form: "form_3-d07w",
  notice: "notice_3-d07w",
  problem: "problem_3-d07w"
};

// src/ui/apps/settings/sections/models-core.ts
var defaultOptions = (kind) => Object.fromEntries((kind?.options ?? []).map((o) => [o.key, o.defaultValue]));
var emptyDraft2 = (kind) => ({
  kind: kind?.id ?? "",
  model: kind?.defaultModel ?? "",
  name: "",
  apiKey: "",
  baseURL: "",
  options: defaultOptions(kind)
});
var draftFrom = (provider, kind) => ({
  id: provider.id,
  kind: provider.kind,
  model: provider.model,
  name: provider.name ?? "",
  apiKey: "",
  baseURL: provider.baseURL ?? "",
  options: { ...defaultOptions(kind), ...provider.options ?? {} }
});
function draftProblem(draft, kind, hasStoredKey = false) {
  if (!kind)
    return "Choose a provider.";
  if (!draft.model.trim())
    return "Choose or type a model.";
  if (kind.needsBaseUrl && !draft.baseURL.trim())
    return "This provider needs a base URL.";
  if (!kind.keyless && !draft.apiKey.trim() && !hasStoredKey)
    return `${kind.label} needs an API key.`;
  return null;
}
function saveBody(draft) {
  const body = { kind: draft.kind, model: draft.model.trim() };
  if (draft.id)
    body["id"] = draft.id;
  if (draft.name.trim())
    body["name"] = draft.name.trim();
  if (draft.baseURL.trim())
    body["baseURL"] = draft.baseURL.trim();
  if (draft.apiKey.trim())
    body["apiKey"] = draft.apiKey.trim();
  if (Object.keys(draft.options).length > 0)
    body["options"] = { ...draft.options };
  return body;
}
function providerLabel(provider, kinds) {
  const kind = kinds.find((k) => k.id === provider.kind);
  const base = kind?.label ?? provider.kind;
  return provider.name ? `${provider.name} (${base})` : `${base} · ${provider.model}`;
}

// src/ui/apps/settings/sections/models.tsx
import { jsxDEV as jsxDEV8, Fragment as Fragment4 } from "react/jsx-dev-runtime";
var TYPE_IT = "__type_an_id__";
function ModelsSection({ ctx }) {
  const [providers, setProviders] = useState7([]);
  const [kinds, setKinds] = useState7([]);
  const [notice, setNotice] = useState7();
  const [draft, setDraft] = useState7(null);
  const [models, setModels] = useState7([]);
  const [busy, setBusy] = useState7(false);
  const [problem, setProblem] = useState7(null);
  const [tested, setTested] = useState7({});
  const [typing, setTyping] = useState7(false);
  const reload = useCallback2(async () => {
    try {
      const reply = await apiFetchJson("/api/agent/providers");
      setProviders(reply.providers);
      setKinds(reply.kinds);
      setNotice(reply.notice);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "could not read the model list");
    }
  }, []);
  useEffect4(() => {
    reload();
  }, [reload]);
  const kindOf = (id) => kinds.find((k) => k.id === id);
  const editing = draft?.id ? providers.find((p) => p.id === draft.id) : undefined;
  const save = async () => {
    if (!draft)
      return;
    const why = draftProblem(draft, kindOf(draft.kind), editing?.hasKey ?? false);
    if (why) {
      setProblem(why);
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      await apiFetchJson("/api/agent/providers/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(saveBody(draft))
      });
      setDraft(null);
      setModels([]);
      await reload();
      ctx.setStatus("model saved");
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "could not save");
    } finally {
      setBusy(false);
    }
  };
  const act = async (path, id, then) => {
    setBusy(true);
    setProblem(null);
    try {
      await apiFetchJson(`/api/agent/providers/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id })
      });
      await reload();
      ctx.setStatus(then);
    } catch (error) {
      setProblem(error instanceof Error ? error.message : "that did not work");
    } finally {
      setBusy(false);
    }
  };
  const test = async (id) => {
    setTested((prior) => ({ ...prior, [id]: "asking..." }));
    try {
      const reply = await apiFetchJson("/api/agent/providers/test", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
      setTested((prior) => ({
        ...prior,
        [id]: reply.ok ? `answered in ${String(reply.ms ?? 0)}ms` : reply.error ?? "no answer"
      }));
    } catch (error) {
      setTested((prior) => ({ ...prior, [id]: error instanceof Error ? error.message : "no answer" }));
    }
  };
  const loadModels = async (target) => {
    try {
      const reply = await apiFetchJson("/api/agent/providers/models", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(target) });
      setModels(reply.models);
    } catch {
      setModels([]);
    }
  };
  return /* @__PURE__ */ jsxDEV8(Fragment4, {
    children: [
      notice && /* @__PURE__ */ jsxDEV8("p", {
        className: models_module_default.notice,
        children: notice
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV8(SettingsRow, {
        label: "Models",
        hint: "Shared with Kit in the terminal. Adding one here adds it there.",
        children: /* @__PURE__ */ jsxDEV8("span", {}, undefined, false, undefined, this)
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV8("ul", {
        className: models_module_default.list,
        children: [
          providers.length === 0 && /* @__PURE__ */ jsxDEV8("li", {
            className: models_module_default.empty,
            children: "No models connected yet."
          }, undefined, false, undefined, this),
          providers.map((p) => /* @__PURE__ */ jsxDEV8("li", {
            className: p.active ? `${models_module_default.row} ${models_module_default.rowActive}` : models_module_default.row,
            children: [
              /* @__PURE__ */ jsxDEV8("label", {
                className: models_module_default.pick,
                children: [
                  /* @__PURE__ */ jsxDEV8("input", {
                    type: "radio",
                    name: "active-provider",
                    checked: p.active,
                    disabled: busy,
                    onChange: () => {
                      act("activate", p.id, "model switched");
                    }
                  }, undefined, false, undefined, this),
                  /* @__PURE__ */ jsxDEV8("span", {
                    className: models_module_default.name,
                    children: providerLabel(p, kinds)
                  }, undefined, false, undefined, this)
                ]
              }, undefined, true, undefined, this),
              /* @__PURE__ */ jsxDEV8("span", {
                className: models_module_default.model,
                children: p.model
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV8("span", {
                className: models_module_default.key,
                children: p.hasKey ? "key saved" : "no key"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV8("span", {
                className: models_module_default.tested,
                children: tested[p.id] ?? ""
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV8("span", {
                className: models_module_default.acts,
                children: [
                  /* @__PURE__ */ jsxDEV8("button", {
                    type: "button",
                    disabled: busy,
                    onClick: () => {
                      test(p.id);
                    },
                    children: "Test"
                  }, undefined, false, undefined, this),
                  /* @__PURE__ */ jsxDEV8("button", {
                    type: "button",
                    disabled: busy,
                    onClick: () => {
                      setDraft(draftFrom(p, kindOf(p.kind)));
                      setModels([]);
                      setTyping(false);
                      loadModels({ id: p.id });
                    },
                    children: "Edit"
                  }, undefined, false, undefined, this),
                  /* @__PURE__ */ jsxDEV8("button", {
                    type: "button",
                    disabled: busy,
                    onClick: () => {
                      act("remove", p.id, "model removed");
                    },
                    children: "Remove"
                  }, undefined, false, undefined, this)
                ]
              }, undefined, true, undefined, this)
            ]
          }, p.id, true, undefined, this))
        ]
      }, undefined, true, undefined, this),
      draft === null ? /* @__PURE__ */ jsxDEV8("button", {
        type: "button",
        className: models_module_default.add,
        disabled: busy || kinds.length === 0,
        onClick: () => {
          const first = kinds[0];
          setDraft(emptyDraft2(first));
          setModels([]);
          setTyping(false);
          if (first)
            loadModels({ kind: first.id });
        },
        children: "Add a model"
      }, undefined, false, undefined, this) : /* @__PURE__ */ jsxDEV8("div", {
        className: models_module_default.form,
        children: [
          /* @__PURE__ */ jsxDEV8("label", {
            children: [
              "Provider",
              /* @__PURE__ */ jsxDEV8("select", {
                value: draft.kind,
                onChange: (e) => {
                  const next = kindOf(e.target.value);
                  setDraft({ ...draft, kind: e.target.value, model: next?.defaultModel ?? "" });
                  setModels([]);
                  setTyping(false);
                  loadModels({ kind: e.target.value });
                },
                children: kinds.map((k) => /* @__PURE__ */ jsxDEV8("option", {
                  value: k.id,
                  children: k.label
                }, k.id, false, undefined, this))
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ jsxDEV8("label", {
            children: [
              "Model",
              models.length > 0 && !typing ? /* @__PURE__ */ jsxDEV8("select", {
                value: draft.model,
                onChange: (e) => {
                  if (e.target.value === TYPE_IT) {
                    setTyping(true);
                    return;
                  }
                  setDraft({ ...draft, model: e.target.value });
                },
                children: [
                  !models.some((m) => m.id === draft.model) && draft.model && /* @__PURE__ */ jsxDEV8("option", {
                    value: draft.model,
                    children: `${draft.model} (saved)`
                  }, undefined, false, undefined, this),
                  models.map((m) => /* @__PURE__ */ jsxDEV8("option", {
                    value: m.id,
                    children: m.label ?? m.id
                  }, m.id, false, undefined, this)),
                  /* @__PURE__ */ jsxDEV8("option", {
                    value: TYPE_IT,
                    children: "Type an id..."
                  }, undefined, false, undefined, this)
                ]
              }, undefined, true, undefined, this) : /* @__PURE__ */ jsxDEV8("input", {
                value: draft.model,
                placeholder: kindOf(draft.kind)?.defaultModel ?? "model id",
                onChange: (e) => {
                  setDraft({ ...draft, model: e.target.value });
                }
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this),
          (kindOf(draft.kind)?.options ?? []).map((option) => /* @__PURE__ */ jsxDEV8("label", {
            children: [
              option.label,
              /* @__PURE__ */ jsxDEV8("select", {
                value: draft.options[option.key] ?? option.defaultValue,
                onChange: (e) => {
                  setDraft({ ...draft, options: { ...draft.options, [option.key]: e.target.value } });
                },
                children: option.choices.map((c) => /* @__PURE__ */ jsxDEV8("option", {
                  value: c.value,
                  children: c.label
                }, c.value, false, undefined, this))
              }, undefined, false, undefined, this)
            ]
          }, option.key, true, undefined, this)),
          /* @__PURE__ */ jsxDEV8("label", {
            children: [
              "Name (optional)",
              /* @__PURE__ */ jsxDEV8("input", {
                value: draft.name,
                placeholder: "Personal, Work",
                onChange: (e) => {
                  setDraft({ ...draft, name: e.target.value });
                }
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this),
          kindOf(draft.kind)?.needsBaseUrl && /* @__PURE__ */ jsxDEV8("label", {
            children: [
              "Base URL",
              /* @__PURE__ */ jsxDEV8("input", {
                value: draft.baseURL,
                placeholder: "http://localhost:1234/v1",
                onChange: (e) => {
                  setDraft({ ...draft, baseURL: e.target.value });
                }
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this),
          !kindOf(draft.kind)?.keyless && /* @__PURE__ */ jsxDEV8("label", {
            children: [
              "API key",
              /* @__PURE__ */ jsxDEV8("input", {
                type: "password",
                value: draft.apiKey,
                autoComplete: "off",
                placeholder: editing?.hasKey ? "leave blank to keep the saved key" : "paste your key",
                onChange: (e) => {
                  setDraft({ ...draft, apiKey: e.target.value });
                }
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ jsxDEV8("div", {
            className: models_module_default.formActs,
            children: [
              /* @__PURE__ */ jsxDEV8("button", {
                type: "button",
                disabled: busy,
                onClick: () => {
                  save();
                },
                children: "Save"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV8("button", {
                type: "button",
                disabled: busy,
                onClick: () => {
                  setDraft(null);
                  setProblem(null);
                },
                children: "Cancel"
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this)
        ]
      }, undefined, true, undefined, this),
      problem !== null && /* @__PURE__ */ jsxDEV8("p", {
        className: models_module_default.problem,
        children: problem
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
var section4 = {
  id: "models",
  label: "Models",
  order: 15,
  Component: ModelsSection
};
var models_default = section4;

// src/ui/apps/settings/sections/remote-access.tsx
import { useEffect as useEffect7, useState as useState10 } from "react";

// src/ui/_shared/clipboard.ts
async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}

// src/ui/apps/settings/sections/lan-card.tsx
import { useEffect as useEffect5, useState as useState8 } from "react";

// src/ui/apps/settings/sections/redact.ts
var mask = (s) => s.replace(/[A-Za-z0-9]/g, "•");

// src/ui/apps/settings/sections/remote-access.module.css
var remote_access_module_default = {
  wrap: "wrap_FL7zVg wrap_z3r0lA",
  title: "title_FL7zVg title_z3r0lA",
  blurb: "blurb_FL7zVg blurb_z3r0lA",
  card: "card_FL7zVg card_z3r0lA",
  hero: "cardHero_FL7zVg hero_z3r0lA",
  cardTitle: "cardTitle_FL7zVg cardTitle_z3r0lA",
  cardBody: "cardBody_FL7zVg cardBody_z3r0lA",
  subtle: "subtle_FL7zVg subtle_z3r0lA",
  actions: "actions_FL7zVg actions_z3r0lA",
  btn: "btn_FL7zVg btn_z3r0lA",
  btnGhost: "btnGhost_FL7zVg btnGhost_z3r0lA",
  btnDanger: "btnDanger_FL7zVg btnDanger_z3r0lA",
  status: "status_FL7zVg status_z3r0lA",
  bad: "statusBad_FL7zVg bad_z3r0lA",
  dot: "dot_FL7zVg dot_z3r0lA",
  on: "dotOn_FL7zVg on_z3r0lA",
  busy: "dotBusy_FL7zVg busy_z3r0lA",
  titleRow: "titleRow_z3r0lA",
  eyeBtn: "eyeBtn_z3r0lA",
  urlbar: "urlbar_z3r0lA",
  lock: "lock_z3r0lA",
  note: "note_z3r0lA",
  devices: "devices_z3r0lA",
  devicesTitle: "devicesTitle_z3r0lA",
  deviceRow: "deviceRow_z3r0lA",
  deviceName: "deviceName_z3r0lA",
  code: "code_z3r0lA"
};

// src/ui/apps/settings/sections/lan-card.tsx
import { jsxDEV as jsxDEV9 } from "react/jsx-dev-runtime";
var OFF = { on: false, code: "", url: "", fingerprint: "", pending: [], connected: [] };
function LanCard({
  ctx,
  hidden,
  redacted
}) {
  const [lan, setLan] = useState8(OFF);
  const [busy, setBusy] = useState8(false);
  useEffect5(() => {
    if (hidden)
      return;
    let alive = true;
    const poll = async () => {
      try {
        const s = await ctx.api.remoteLanStatus();
        if (alive)
          setLan(s);
      } catch {}
    };
    poll();
    const id = setInterval(() => void poll(), 1500);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [ctx, hidden]);
  if (hidden)
    return null;
  const run = (p) => {
    setBusy(true);
    p.then(setLan).catch(() => {}).finally(() => setBusy(false));
  };
  const settle = (p) => {
    p.then(setLan).catch(() => {});
  };
  if (!lan.on) {
    return /* @__PURE__ */ jsxDEV9("div", {
      className: remote_access_module_default.card,
      children: [
        /* @__PURE__ */ jsxDEV9("div", {
          className: remote_access_module_default.cardTitle,
          children: "Local network access"
        }, undefined, false, undefined, this),
        /* @__PURE__ */ jsxDEV9("div", {
          className: remote_access_module_default.cardBody,
          children: [
            "A no-account option: reach this studio from devices on the ",
            /* @__PURE__ */ jsxDEV9("b", {
              children: "same network"
            }, undefined, false, undefined, this),
            " (home or office Wi-Fi), with no Tailscale sign-in. Each device enters a connect code, and you approve it here before it gets in."
          ]
        }, undefined, true, undefined, this),
        /* @__PURE__ */ jsxDEV9("div", {
          className: remote_access_module_default.actions,
          children: /* @__PURE__ */ jsxDEV9("button", {
            type: "button",
            className: remote_access_module_default.btn,
            disabled: busy,
            onClick: () => run(ctx.api.remoteLanEnable()),
            children: "Enable local access"
          }, undefined, false, undefined, this)
        }, undefined, false, undefined, this)
      ]
    }, undefined, true, undefined, this);
  }
  return /* @__PURE__ */ jsxDEV9("div", {
    className: remote_access_module_default.card,
    children: [
      /* @__PURE__ */ jsxDEV9("div", {
        className: remote_access_module_default.cardTitle,
        children: /* @__PURE__ */ jsxDEV9("span", {
          className: remote_access_module_default.status,
          children: [
            /* @__PURE__ */ jsxDEV9("span", {
              className: `${remote_access_module_default.dot} ${remote_access_module_default.on}`
            }, undefined, false, undefined, this),
            "Local access on"
          ]
        }, undefined, true, undefined, this)
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV9("div", {
        className: remote_access_module_default.cardBody,
        children: "On a device on this network, open the link and enter this code. Only enable on a network you trust."
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV9("div", {
        className: remote_access_module_default.code,
        children: redacted ? mask(lan.code) : lan.code
      }, undefined, false, undefined, this),
      lan.url && /* @__PURE__ */ jsxDEV9("span", {
        className: remote_access_module_default.urlbar,
        children: redacted ? mask(lan.url) : lan.url
      }, undefined, false, undefined, this),
      lan.fingerprint && /* @__PURE__ */ jsxDEV9("div", {
        className: remote_access_module_default.subtle,
        children: [
          "Certificate fingerprint (verify on first connect):",
          " ",
          redacted ? mask(lan.fingerprint) : lan.fingerprint
        ]
      }, undefined, true, undefined, this),
      lan.pending.length > 0 && /* @__PURE__ */ jsxDEV9("div", {
        className: remote_access_module_default.devices,
        children: [
          /* @__PURE__ */ jsxDEV9("div", {
            className: remote_access_module_default.devicesTitle,
            children: "Wants to connect"
          }, undefined, false, undefined, this),
          lan.pending.map((d) => /* @__PURE__ */ jsxDEV9("div", {
            className: remote_access_module_default.deviceRow,
            children: [
              /* @__PURE__ */ jsxDEV9("span", {
                className: remote_access_module_default.deviceName,
                children: redacted ? mask(d.label) : d.label
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV9("div", {
                className: remote_access_module_default.actions,
                children: [
                  /* @__PURE__ */ jsxDEV9("button", {
                    type: "button",
                    className: remote_access_module_default.btn,
                    onClick: () => settle(ctx.api.remoteLanApprove(d.id)),
                    children: "Approve"
                  }, undefined, false, undefined, this),
                  /* @__PURE__ */ jsxDEV9("button", {
                    type: "button",
                    className: `${remote_access_module_default.btnGhost} ${remote_access_module_default.btnDanger}`,
                    onClick: () => settle(ctx.api.remoteLanDeny(d.id)),
                    children: "Deny"
                  }, undefined, false, undefined, this)
                ]
              }, undefined, true, undefined, this)
            ]
          }, d.id, true, undefined, this))
        ]
      }, undefined, true, undefined, this),
      lan.connected.length > 0 && /* @__PURE__ */ jsxDEV9("div", {
        className: remote_access_module_default.devices,
        children: [
          /* @__PURE__ */ jsxDEV9("div", {
            className: remote_access_module_default.devicesTitle,
            children: "Connected devices"
          }, undefined, false, undefined, this),
          lan.connected.map((d) => /* @__PURE__ */ jsxDEV9("div", {
            className: remote_access_module_default.deviceRow,
            children: [
              /* @__PURE__ */ jsxDEV9("span", {
                className: remote_access_module_default.deviceName,
                children: redacted ? mask(d.label) : d.label
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV9("button", {
                type: "button",
                className: `${remote_access_module_default.btnGhost} ${remote_access_module_default.btnDanger}`,
                onClick: () => settle(ctx.api.remoteLanKick(d.id)),
                children: "Remove"
              }, undefined, false, undefined, this)
            ]
          }, d.id, true, undefined, this))
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV9("div", {
        className: remote_access_module_default.actions,
        children: /* @__PURE__ */ jsxDEV9("button", {
          type: "button",
          className: `${remote_access_module_default.btnGhost} ${remote_access_module_default.btnDanger}`,
          disabled: busy,
          onClick: () => run(ctx.api.remoteLanDisable()),
          children: "Turn off local access"
        }, undefined, false, undefined, this)
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}

// src/ui/apps/settings/sections/helper-card.tsx
import { useEffect as useEffect6, useState as useState9 } from "react";
import { jsxDEV as jsxDEV10, Fragment as Fragment5 } from "react/jsx-dev-runtime";
function useHelper(ctx, onFirstInstall) {
  const [status, setStatus] = useState9(null);
  const [busy, setBusy] = useState9(false);
  const [error, setError] = useState9("");
  useEffect6(() => {
    let alive = true;
    ctx.api.remoteHelperStatus().then((s) => {
      if (alive)
        setStatus(s);
    }).catch(() => {});
    return () => {
      alive = false;
    };
  }, [ctx]);
  const download = () => {
    const wasMissing = !status?.installed;
    setBusy(true);
    setError("");
    ctx.api.remoteHelperDownload().then((s) => {
      setStatus(s);
      if (wasMissing)
        onFirstInstall();
    }).catch((e) => {
      setError(e instanceof Error && e.message ? e.message : "The download did not finish. Nothing was installed.");
    }).finally(() => setBusy(false));
  };
  return { status, busy, error, download };
}
function HelperError({ h }) {
  if (!h.error)
    return null;
  return /* @__PURE__ */ jsxDEV10("span", {
    className: `${remote_access_module_default.status} ${remote_access_module_default.bad}`,
    children: [
      /* @__PURE__ */ jsxDEV10("span", {
        className: remote_access_module_default.dot
      }, undefined, false, undefined, this),
      h.error
    ]
  }, undefined, true, undefined, this);
}
function HelperMissingCard({ detail, h }) {
  const offered = h.status?.offered ?? false;
  return /* @__PURE__ */ jsxDEV10("div", {
    className: remote_access_module_default.card,
    children: [
      /* @__PURE__ */ jsxDEV10("div", {
        className: remote_access_module_default.cardTitle,
        children: offered ? "Add the private-mesh link" : "Private-mesh link not available in this copy"
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV10("div", {
        className: remote_access_module_default.cardBody,
        children: offered ? "The private-mesh link needs one extra piece that is not bundled with the app, to keep the download small. Hoplight can fetch it for you now, once." : detail ?? "This copy of Hoplight was built without the Tailscale helper."
      }, undefined, false, undefined, this),
      offered && /* @__PURE__ */ jsxDEV10("div", {
        className: remote_access_module_default.actions,
        children: [
          /* @__PURE__ */ jsxDEV10("button", {
            type: "button",
            className: remote_access_module_default.btn,
            disabled: h.busy,
            onClick: () => h.download(),
            children: h.busy ? "Downloading..." : "Download the extra piece"
          }, undefined, false, undefined, this),
          h.busy && /* @__PURE__ */ jsxDEV10("span", {
            className: remote_access_module_default.status,
            children: [
              /* @__PURE__ */ jsxDEV10("span", {
                className: `${remote_access_module_default.dot} ${remote_access_module_default.busy}`
              }, undefined, false, undefined, this),
              "About 31 MB. This takes a moment."
            ]
          }, undefined, true, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV10(HelperError, {
        h
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV10("div", {
        className: remote_access_module_default.subtle,
        children: offered ? /* @__PURE__ */ jsxDEV10(Fragment5, {
          children: [
            "It is downloaded from Hoplight's own releases and checked against a fingerprint built into this copy; a file that does not match is thrown away rather than used. You can skip this entirely and use ",
            /* @__PURE__ */ jsxDEV10("b", {
              children: "LAN mode"
            }, undefined, false, undefined, this),
            " below, which needs no download."
          ]
        }, undefined, true, undefined, this) : /* @__PURE__ */ jsxDEV10(Fragment5, {
          children: [
            "Nothing is wrong with your studio, and nothing else is affected. Use ",
            /* @__PURE__ */ jsxDEV10("b", {
              children: "LAN mode"
            }, undefined, false, undefined, this),
            " below to reach this studio from another device on the same network."
          ]
        }, undefined, true, undefined, this)
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
function HelperInstalledLine({ h }) {
  if (!h.status?.installed)
    return /* @__PURE__ */ jsxDEV10(HelperError, {
      h
    }, undefined, false, undefined, this);
  return /* @__PURE__ */ jsxDEV10(Fragment5, {
    children: [
      /* @__PURE__ */ jsxDEV10("div", {
        className: remote_access_module_default.subtle,
        children: [
          "Mesh helper downloaded",
          h.status.installedTag ? ` with ${h.status.installedTag}` : "",
          ".",
          " ",
          /* @__PURE__ */ jsxDEV10("button", {
            type: "button",
            className: remote_access_module_default.btnGhost,
            disabled: h.busy,
            onClick: () => h.download(),
            children: h.busy ? "Downloading..." : "Get it again"
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV10(HelperError, {
        h
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}

// src/ui/apps/settings/sections/remote-access.tsx
import { jsxDEV as jsxDEV11, Fragment as Fragment6 } from "react/jsx-dev-runtime";
function EyeIcon({ off }) {
  return /* @__PURE__ */ jsxDEV11("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
    children: [
      /* @__PURE__ */ jsxDEV11("path", {
        d: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV11("circle", {
        cx: "12",
        cy: "12",
        r: "3"
      }, undefined, false, undefined, this),
      off && /* @__PURE__ */ jsxDEV11("line", {
        x1: "3",
        y1: "3",
        x2: "21",
        y2: "21"
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
function LockIcon() {
  return /* @__PURE__ */ jsxDEV11("svg", {
    className: remote_access_module_default.lock,
    width: "13",
    height: "13",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2.2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
    children: [
      /* @__PURE__ */ jsxDEV11("rect", {
        x: "4.5",
        y: "10.5",
        width: "15",
        height: "10",
        rx: "2"
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV11("path", {
        d: "M8 10.5V7a4 4 0 0 1 8 0v3.5"
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
var TAILSCALE_HTTPS_ADMIN = "https://login.tailscale.com/admin/dns";
function StateCard({
  state,
  a,
  redacted
}) {
  switch (state.phase) {
    case "off":
      return /* @__PURE__ */ jsxDEV11("div", {
        className: `${remote_access_module_default.card} ${remote_access_module_default.hero}`,
        children: [
          /* @__PURE__ */ jsxDEV11("div", {
            className: remote_access_module_default.cardTitle,
            children: "Turn on remote access"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV11("div", {
            className: remote_access_module_default.cardBody,
            children: "Hoplight stays on your machine. A private, encrypted link lets your own devices reach it, with no router changes and no ports opened. You sign in to Tailscale once (free); we open that page for you."
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV11("div", {
            className: remote_access_module_default.actions,
            children: /* @__PURE__ */ jsxDEV11("button", {
              type: "button",
              className: remote_access_module_default.btn,
              disabled: a.busy,
              onClick: () => a.enable(),
              children: "Enable remote access"
            }, undefined, false, undefined, this)
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV11(HelperInstalledLine, {
            h: a.helper
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this);
    case "unavailable":
      return /* @__PURE__ */ jsxDEV11(HelperMissingCard, {
        detail: state.detail,
        h: a.helper
      }, undefined, false, undefined, this);
    case "starting":
      return /* @__PURE__ */ jsxDEV11("div", {
        className: remote_access_module_default.card,
        children: [
          /* @__PURE__ */ jsxDEV11("div", {
            className: remote_access_module_default.cardTitle,
            children: "Bringing up the private link"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV11("span", {
            className: remote_access_module_default.status,
            children: [
              /* @__PURE__ */ jsxDEV11("span", {
                className: `${remote_access_module_default.dot} ${remote_access_module_default.busy}`
              }, undefined, false, undefined, this),
              "Starting. This is quick."
            ]
          }, undefined, true, undefined, this)
        ]
      }, undefined, true, undefined, this);
    case "needs-login": {
      const signInUrl = state.signInUrl;
      return /* @__PURE__ */ jsxDEV11("div", {
        className: remote_access_module_default.card,
        children: [
          /* @__PURE__ */ jsxDEV11("div", {
            className: remote_access_module_default.cardTitle,
            children: "Sign in to Tailscale"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV11("div", {
            className: remote_access_module_default.cardBody,
            children: "A Tailscale sign-in page just opened in your browser. Sign in once (free), then come back here. This reconnects on its own."
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV11("div", {
            className: remote_access_module_default.actions,
            children: [
              /* @__PURE__ */ jsxDEV11("span", {
                className: remote_access_module_default.status,
                children: [
                  /* @__PURE__ */ jsxDEV11("span", {
                    className: `${remote_access_module_default.dot} ${remote_access_module_default.busy}`
                  }, undefined, false, undefined, this),
                  "Waiting for sign-in"
                ]
              }, undefined, true, undefined, this),
              signInUrl && /* @__PURE__ */ jsxDEV11("button", {
                type: "button",
                className: remote_access_module_default.btnGhost,
                onClick: () => requestExternal(signInUrl, "Tailscale sign-in"),
                children: "Open sign-in again"
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this)
        ]
      }, undefined, true, undefined, this);
    }
    case "needs-https":
      return /* @__PURE__ */ jsxDEV11("div", {
        className: remote_access_module_default.card,
        children: [
          /* @__PURE__ */ jsxDEV11("div", {
            className: remote_access_module_default.cardTitle,
            children: "One more setup step: turn on HTTPS"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV11("div", {
            className: remote_access_module_default.cardBody,
            children: [
              "Tailscale needs HTTPS certificates enabled for your account, a one-time switch. Open your Tailscale settings, turn on ",
              /* @__PURE__ */ jsxDEV11("b", {
                children: "HTTPS Certificates"
              }, undefined, false, undefined, this),
              ", and this connects on its own, you do not need to come back here and click anything."
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ jsxDEV11("div", {
            className: remote_access_module_default.actions,
            children: [
              /* @__PURE__ */ jsxDEV11("button", {
                type: "button",
                className: remote_access_module_default.btn,
                onClick: () => a.openHttpsSettings(),
                children: "Open Tailscale HTTPS settings"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV11("span", {
                className: remote_access_module_default.status,
                children: [
                  /* @__PURE__ */ jsxDEV11("span", {
                    className: `${remote_access_module_default.dot} ${remote_access_module_default.busy}`
                  }, undefined, false, undefined, this),
                  "Waiting for HTTPS to be turned on"
                ]
              }, undefined, true, undefined, this)
            ]
          }, undefined, true, undefined, this)
        ]
      }, undefined, true, undefined, this);
    case "connected":
      return /* @__PURE__ */ jsxDEV11("div", {
        className: `${remote_access_module_default.card} ${remote_access_module_default.hero}`,
        children: [
          /* @__PURE__ */ jsxDEV11("div", {
            className: remote_access_module_default.cardTitle,
            children: /* @__PURE__ */ jsxDEV11("span", {
              className: remote_access_module_default.status,
              children: [
                /* @__PURE__ */ jsxDEV11("span", {
                  className: `${remote_access_module_default.dot} ${remote_access_module_default.on}`
                }, undefined, false, undefined, this),
                "On, reachable"
              ]
            }, undefined, true, undefined, this)
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV11("div", {
            className: remote_access_module_default.cardBody,
            children: "Open this link on any device signed into the same Tailscale account, your phone, another computer. It is a real, trusted https link with no certificate warnings."
          }, undefined, false, undefined, this),
          state.url && /* @__PURE__ */ jsxDEV11("span", {
            className: remote_access_module_default.urlbar,
            children: [
              /* @__PURE__ */ jsxDEV11(LockIcon, {}, undefined, false, undefined, this),
              redacted ? mask(state.url) : state.url
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ jsxDEV11("div", {
            className: remote_access_module_default.actions,
            children: [
              state.url && /* @__PURE__ */ jsxDEV11("button", {
                type: "button",
                className: remote_access_module_default.btnGhost,
                onClick: () => a.copyLink(),
                children: a.copied ? "Copied" : "Copy link"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV11("button", {
                type: "button",
                className: `${remote_access_module_default.btnGhost} ${remote_access_module_default.btnDanger}`,
                disabled: a.busy,
                onClick: () => a.disable(),
                children: "Turn off"
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ jsxDEV11("div", {
            className: remote_access_module_default.subtle,
            children: "To add a device: install the free Tailscale app on it, sign in with the same account, then open the link above."
          }, undefined, false, undefined, this),
          a.devices.length > 0 && /* @__PURE__ */ jsxDEV11("div", {
            className: remote_access_module_default.devices,
            children: [
              /* @__PURE__ */ jsxDEV11("div", {
                className: remote_access_module_default.devicesTitle,
                children: "Connected devices"
              }, undefined, false, undefined, this),
              a.devices.map((d) => /* @__PURE__ */ jsxDEV11("div", {
                className: remote_access_module_default.deviceRow,
                children: [
                  /* @__PURE__ */ jsxDEV11("span", {
                    className: remote_access_module_default.deviceName,
                    children: redacted ? mask(d.name || d.nodeId) : d.name || d.nodeId
                  }, undefined, false, undefined, this),
                  /* @__PURE__ */ jsxDEV11("button", {
                    type: "button",
                    className: `${remote_access_module_default.btnGhost} ${remote_access_module_default.btnDanger}`,
                    onClick: () => a.kick(d.nodeId),
                    children: "Remove"
                  }, undefined, false, undefined, this)
                ]
              }, d.nodeId, true, undefined, this))
            ]
          }, undefined, true, undefined, this)
        ]
      }, undefined, true, undefined, this);
    case "error":
      return /* @__PURE__ */ jsxDEV11("div", {
        className: remote_access_module_default.card,
        children: [
          /* @__PURE__ */ jsxDEV11("div", {
            className: remote_access_module_default.cardTitle,
            children: "Remote access could not start"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV11("span", {
            className: `${remote_access_module_default.status} ${remote_access_module_default.bad}`,
            children: [
              /* @__PURE__ */ jsxDEV11("span", {
                className: remote_access_module_default.dot
              }, undefined, false, undefined, this),
              state.error ?? "Something stopped the link from coming up."
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ jsxDEV11("div", {
            className: remote_access_module_default.cardBody,
            children: "Nothing else in Hoplight is affected."
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV11("div", {
            className: remote_access_module_default.actions,
            children: /* @__PURE__ */ jsxDEV11("button", {
              type: "button",
              className: remote_access_module_default.btn,
              disabled: a.busy,
              onClick: () => a.enable(),
              children: "Try again"
            }, undefined, false, undefined, this)
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this);
    default:
      return assertNever(state.phase);
  }
}
var assertNever = (x) => {
  throw new Error(`remote-access: unhandled phase ${JSON.stringify(x)}`);
};
function RemoteAccessSection({ ctx }) {
  const [state, setState] = useState10({ phase: "off" });
  const [busy, setBusy] = useState10(false);
  const [managedElsewhere, setManagedElsewhere] = useState10(false);
  const [devices, setDevices] = useState10([]);
  const [redacted, setRedacted] = useState10(false);
  const helper = useHelper(ctx, () => enable());
  useEffect7(() => {
    let alive = true;
    const poll = async () => {
      try {
        const s = await ctx.api.remoteStatus();
        if (!alive)
          return;
        setState(s);
        setManagedElsewhere(false);
        if (s.phase === "connected") {
          const d = await ctx.api.remoteDevices().catch(() => []);
          if (alive)
            setDevices(d);
        } else {
          setDevices([]);
        }
      } catch (e) {
        if (alive && apiStatusIs(e, 403))
          setManagedElsewhere(true);
      }
    };
    poll();
    const id = setInterval(() => void poll(), 1500);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [ctx]);
  const enable = () => {
    setBusy(true);
    ctx.api.remoteEnable().then(setState).catch(() => {}).finally(() => setBusy(false));
  };
  const disable = () => {
    setBusy(true);
    ctx.api.remoteDisable().then(setState).catch(() => {}).finally(() => setBusy(false));
  };
  const [copied, setCopied] = useState10(false);
  const copyLink = () => {
    if (!state.url)
      return;
    copyText(state.url).then((ok) => {
      if (!ok)
        return;
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  const openHttpsSettings = () => {
    requestExternal(TAILSCALE_HTTPS_ADMIN, "Tailscale HTTPS settings");
  };
  const kick = (nodeId) => {
    ctx.api.remoteKick(nodeId).then(() => ctx.api.remoteDevices()).then((d) => setDevices(d)).catch(() => {});
  };
  return /* @__PURE__ */ jsxDEV11("div", {
    className: remote_access_module_default.wrap,
    children: [
      /* @__PURE__ */ jsxDEV11("div", {
        children: [
          /* @__PURE__ */ jsxDEV11("div", {
            className: remote_access_module_default.titleRow,
            children: [
              /* @__PURE__ */ jsxDEV11("div", {
                className: remote_access_module_default.title,
                children: "Remote access"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV11("button", {
                type: "button",
                className: remote_access_module_default.eyeBtn,
                "aria-pressed": redacted,
                title: redacted ? "Show details" : "Hide details for a screenshot",
                "aria-label": redacted ? "Show details" : "Hide details for a screenshot",
                onClick: () => setRedacted((v) => !v),
                children: /* @__PURE__ */ jsxDEV11(EyeIcon, {
                  off: redacted
                }, undefined, false, undefined, this)
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ jsxDEV11("div", {
            className: remote_access_module_default.blurb,
            children: state.phase === "unavailable" ? /* @__PURE__ */ jsxDEV11(Fragment6, {
              children: "Reach this studio from your phone or another computer on the same network. Off by default, and no account needed."
            }, undefined, false, undefined, this) : /* @__PURE__ */ jsxDEV11(Fragment6, {
              children: "Reach this studio from your phone or another computer, over a private, encrypted link. Off by default. Turning it on needs a one-time free Tailscale sign-in, Hoplight opens that page for you."
            }, undefined, false, undefined, this)
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      managedElsewhere ? /* @__PURE__ */ jsxDEV11("div", {
        className: remote_access_module_default.card,
        children: [
          /* @__PURE__ */ jsxDEV11("div", {
            className: remote_access_module_default.cardTitle,
            children: "Managed on the host device"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV11("div", {
            className: remote_access_module_default.cardBody,
            children: "You are connected to this studio remotely. Remote access is turned on or off, and devices are managed, only on the computer actually running Hoplight, never from a device that connected in. Open Hoplight on that computer to change these settings."
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this) : /* @__PURE__ */ jsxDEV11(StateCard, {
        state,
        a: {
          enable,
          disable,
          copyLink,
          openHttpsSettings,
          kick,
          devices,
          busy,
          copied,
          helper
        },
        redacted
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV11(LanCard, {
        ctx,
        hidden: managedElsewhere,
        redacted
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
var section5 = {
  id: "remote-access",
  label: "Remote access",
  order: 85,
  Component: RemoteAccessSection
};
var remote_access_default = section5;

// src/ui/apps/settings/sections/studio.tsx
import { useEffect as useEffect9, useState as useState12 } from "react";

// src/ui/_shared/decks.ts
var DECKS = [
  { kind: "character", plural: "Characters", short: "char", accent: "var(--deck-character)" },
  { kind: "lorebook", plural: "Lorebooks", short: "lore", accent: "var(--deck-lorebook)" },
  { kind: "persona", plural: "Personas", short: "pers", accent: "var(--deck-persona)" },
  { kind: "pack", plural: "Sprite packs", short: "pack", accent: "var(--deck-pack)" },
  { kind: "preset", plural: "Presets", short: "set", accent: "var(--deck-preset)" },
  { kind: "regex", plural: "Regex sets", short: "rgx", accent: "var(--deck-regex)" },
  { kind: "quickreply", plural: "Quick replies", short: "qr", accent: "var(--deck-preset)" }
];
var BY_KIND = new Map(DECKS.map((d) => [d.kind, d]));
var knownDecks = () => [...DECKS];

// src/ui/apps/settings/sections/engines.tsx
import { useCallback as useCallback3, useEffect as useEffect8, useState as useState11 } from "react";

// src/ui/apps/settings/sections/engines-core.ts
function engineState(row) {
  if (row.from === "env") {
    return { note: `in use, from ${row.rootVar}`, ok: true, locked: true };
  }
  if (row.env) {
    return { note: `${row.rootVar} is set but no engine is there`, ok: false, locked: true };
  }
  if (row.from === "saved")
    return { note: "in use", ok: true, locked: false };
  if (row.saved)
    return { note: "saved, but nothing is there now", ok: false, locked: false };
  return { note: "not set", ok: false, locked: false };
}

// src/ui/apps/settings/sections/engines.module.css
var engines_module_default = {
  field: "field_30KD9g",
  path: "path_30KD9g",
  acts: "acts_30KD9g",
  note: "note_30KD9g",
  good: "good_30KD9g",
  said: "said_30KD9g"
};

// src/ui/apps/settings/sections/engines.tsx
import { jsxDEV as jsxDEV12, Fragment as Fragment7 } from "react/jsx-dev-runtime";
function EngineRoots() {
  const [rows, setRows] = useState11([]);
  const [draft, setDraft] = useState11({});
  const [busy, setBusy] = useState11(null);
  const [said, setSaid] = useState11({});
  const take = useCallback3((next) => {
    setRows(next);
    setDraft(Object.fromEntries(next.map((r) => [r.id, r.saved])));
  }, []);
  useEffect8(() => {
    (async () => {
      try {
        const reply = await apiFetchJson("/api/macro-lab/roots");
        take(reply.engines);
      } catch {
        take([]);
      }
    })();
  }, [take]);
  const save = async (row, root) => {
    setBusy(row.id);
    setSaid((prior) => ({ ...prior, [row.id]: "" }));
    try {
      const reply = await apiFetchJson("/api/macro-lab/roots", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ engine: row.id, root })
      });
      take(reply.engines);
      setSaid((prior) => ({ ...prior, [row.id]: root ? "saved" : "cleared" }));
    } catch (error) {
      setSaid((prior) => ({
        ...prior,
        [row.id]: error instanceof Error ? error.message : "could not save that folder"
      }));
    } finally {
      setBusy(null);
    }
  };
  if (rows.length === 0)
    return /* @__PURE__ */ jsxDEV12(Fragment7, {}, undefined, false, undefined, this);
  return /* @__PURE__ */ jsxDEV12(Fragment7, {
    children: rows.map((row) => {
      const { note, ok, locked } = engineState(row);
      return /* @__PURE__ */ jsxDEV12(SettingsRow, {
        label: row.label,
        hint: locked ? `Set by ${row.rootVar} for this run, so the folder below is not being used. ` + "Unset the variable to go back to the saved one." : `The folder holding ${row.install}. Kit uses it too.`,
        children: /* @__PURE__ */ jsxDEV12("div", {
          className: engines_module_default.field,
          children: [
            /* @__PURE__ */ jsxDEV12("input", {
              className: engines_module_default.path,
              value: draft[row.id] ?? "",
              spellCheck: false,
              disabled: locked || busy !== null,
              placeholder: "paste the folder's path",
              "aria-label": `${row.label} folder`,
              onChange: (e) => {
                setDraft((prior) => ({ ...prior, [row.id]: e.target.value }));
              }
            }, undefined, false, undefined, this),
            /* @__PURE__ */ jsxDEV12("div", {
              className: engines_module_default.acts,
              children: [
                /* @__PURE__ */ jsxDEV12("button", {
                  type: "button",
                  disabled: locked || busy !== null,
                  onClick: () => {
                    save(row, draft[row.id] ?? "");
                  },
                  children: "Save"
                }, undefined, false, undefined, this),
                row.saved !== "" && /* @__PURE__ */ jsxDEV12("button", {
                  type: "button",
                  disabled: locked || busy !== null,
                  onClick: () => {
                    save(row, "");
                  },
                  children: "Clear"
                }, undefined, false, undefined, this)
              ]
            }, undefined, true, undefined, this),
            /* @__PURE__ */ jsxDEV12("p", {
              className: ok ? engines_module_default.good : engines_module_default.note,
              children: note
            }, undefined, false, undefined, this),
            locked && /* @__PURE__ */ jsxDEV12("p", {
              className: engines_module_default.said,
              children: row.env
            }, undefined, false, undefined, this),
            said[row.id] && /* @__PURE__ */ jsxDEV12("p", {
              className: engines_module_default.said,
              children: said[row.id]
            }, undefined, false, undefined, this)
          ]
        }, undefined, true, undefined, this)
      }, row.id, false, undefined, this);
    })
  }, undefined, false, undefined, this);
}

// src/ui/apps/settings/sections/studio.tsx
import { jsxDEV as jsxDEV13, Fragment as Fragment8 } from "react/jsx-dev-runtime";
function StudioSection({ ctx }) {
  const apps = ctx.apps().filter((m) => !m.comingSoon && !m.dockFoot && !m.catalogOnly);
  const [home, setHome] = useState12(() => {
    const h = ctx.prefs.get(SETTING_KEYS.homeApp);
    return typeof h === "string" && apps.some((m) => m.id === h) ? h : apps[0]?.id ?? "";
  });
  const [firstDeck, setFirstDeck] = useState12(() => {
    const f = ctx.prefs.get(SETTING_KEYS.firstDeck);
    return typeof f === "string" && f ? f : "character";
  });
  const [platforms, setPlatforms] = useState12([]);
  const [picked, setPicked] = useState12(() => {
    const p = ctx.prefs.get(SETTING_KEYS.publishTargets);
    return new Set(Array.isArray(p) ? p : []);
  });
  useEffect9(() => {
    let cancelled = false;
    (async () => {
      const formats = await ctx.api.formats();
      const list = [...new Set(formats.filter((f) => !f.native).map((f) => f.friendly))].sort((a, b) => a.localeCompare(b));
      if (!cancelled)
        setPlatforms(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [ctx]);
  const togglePlatform = (p) => {
    const next = new Set(picked);
    if (next.has(p))
      next.delete(p);
    else
      next.add(p);
    setPicked(next);
    ctx.prefs.set(SETTING_KEYS.publishTargets, [...next]);
  };
  return /* @__PURE__ */ jsxDEV13(Fragment8, {
    children: [
      /* @__PURE__ */ jsxDEV13(SettingsRow, {
        label: "Home",
        hint: "The room Hoplight opens in when you start it.",
        children: /* @__PURE__ */ jsxDEV13(SegControl, {
          options: apps.map((m) => ({ value: m.id, label: m.title.replace(/^The /, "") })),
          current: home,
          onPick: (v) => {
            ctx.prefs.set(SETTING_KEYS.homeApp, v);
            setHome(v);
          }
        }, undefined, false, undefined, this)
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV13(SettingsRow, {
        label: "Library opens on",
        hint: "The deck you see first when you visit the shelves.",
        children: /* @__PURE__ */ jsxDEV13(SegControl, {
          options: knownDecks().map((d) => ({ value: d.kind, label: d.plural })),
          current: firstDeck,
          onPick: (v) => {
            ctx.prefs.set(SETTING_KEYS.firstDeck, v);
            setFirstDeck(v);
          }
        }, undefined, false, undefined, this)
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV13(SettingsRow, {
        label: "You publish to",
        hint: "Pick any that fit. Every format stays ready either way.",
        children: /* @__PURE__ */ jsxDEV13("div", {
          className: styles_module_default.plates,
          children: platforms.map((p) => /* @__PURE__ */ jsxDEV13("button", {
            type: "button",
            className: picked.has(p) ? `${styles_module_default.plate} ${styles_module_default.on}` : styles_module_default.plate,
            onClick: () => togglePlatform(p),
            children: p
          }, p, false, undefined, this))
        }, undefined, false, undefined, this)
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV13(EngineRoots, {}, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
var section6 = {
  id: "studio",
  label: "Studio",
  order: 20,
  Component: StudioSection
};
var studio_default = section6;

// src/ui/apps/settings/sections/updates.tsx
import { useEffect as useEffect10, useState as useState13 } from "react";

// src/ui/_shared/version-history.ts
var TAG_SHAPE = /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
var isRec2 = (v) => typeof v === "object" && v !== null && !Array.isArray(v);
var str = (v) => typeof v === "string" ? v : "";
var isPlumbing = (subject) => /^release:/i.test(subject) || /^Merge /.test(subject);
function parseCommitBlock(body) {
  if (typeof body !== "string" || body === "")
    return [];
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === "```commits");
  if (start < 0)
    return [];
  const commits = [];
  for (let i = start + 1;i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "```")
      break;
    const m = /^([0-9a-f]{7,40}) (.+)$/.exec(line.trim());
    if (m)
      commits.push({ hash: m[1], subject: m[2] });
  }
  return commits;
}
function headlineOf(commits) {
  const real = commits.find((c) => !isPlumbing(c.subject));
  if (real)
    return real.subject;
  return commits[0]?.subject ?? "";
}
function readReleasesList(json) {
  if (!Array.isArray(json))
    return [];
  const seen = new Set;
  const out = [];
  for (const raw of json) {
    if (!isRec2(raw))
      continue;
    if (raw.draft === true || raw.prerelease === true)
      continue;
    const version = str(raw.tag_name);
    if (!TAG_SHAPE.test(version))
      continue;
    if (seen.has(version))
      continue;
    seen.add(version);
    const commits = parseCommitBlock(str(raw.body));
    out.push({
      version,
      name: str(raw.name) || version,
      date: str(raw.published_at),
      url: str(raw.html_url),
      headline: headlineOf(commits),
      commits
    });
  }
  out.sort((a, b) => compareVersions(b.version, a.version));
  return out;
}
function buildTimeline(releases, installed, hasMore = false) {
  const rows = releases.map((release) => {
    const cmp = compareVersions(release.version, installed);
    if (cmp === 0)
      return { release, relation: "here", distance: 0 };
    if (cmp > 0) {
      const distance2 = releases.filter((r) => compareVersions(r.version, installed) > 0 && compareVersions(r.version, release.version) <= 0).length;
      return { release, relation: "ahead", distance: distance2 };
    }
    const distance = releases.filter((r) => compareVersions(r.version, installed) < 0 && compareVersions(r.version, release.version) >= 0).length;
    return { release, relation: "behind", distance };
  });
  const behind = rows.filter((r) => r.relation === "ahead").length;
  const installedInList = rows.some((r) => r.relation === "here");
  return {
    rows,
    installed,
    latest: releases[0]?.version ?? null,
    behind,
    installedInList,
    hasMore
  };
}

// src/ui/_shared/switch-decision.ts
var UPDATES_FEATURE_MIN_VERSION = "v0.1.13";
function isFeatureAware(version) {
  return UPDATES_FEATURE_MIN_VERSION !== "" && compareVersions(version, UPDATES_FEATURE_MIN_VERSION) >= 0;
}
function switchKind(installed, target) {
  const cmp = compareVersions(target, installed);
  if (cmp === 0)
    return "current";
  return cmp > 0 ? "update" : "rollback";
}

// src/ui/_shared/pending-switch.ts
var PENDING_SWITCH_TTL_MS = 15 * 60 * 1000;
function reducePendingSwitch(marker, running, now) {
  if (!marker)
    return { kind: "none" };
  if (now - marker.at > PENDING_SWITCH_TTL_MS)
    return { kind: "none" };
  if (compareVersions(running, marker.to) === 0)
    return { kind: "success", from: marker.from, to: marker.to };
  if (compareVersions(running, marker.from) === 0)
    return { kind: "failed", from: marker.from, to: marker.to };
  return { kind: "none" };
}

// src/ui/apps/settings/sections/updates.module.css
var updates_module_default = {
  wrap: "wrap_FL7zVg wrap_BHLlhQ",
  title: "title_FL7zVg title_BHLlhQ",
  blurb: "blurb_FL7zVg blurb_BHLlhQ",
  card: "card_FL7zVg card_BHLlhQ",
  hero: "cardHero_FL7zVg hero_BHLlhQ",
  cardTitle: "cardTitle_FL7zVg cardTitle_BHLlhQ",
  cardBody: "cardBody_FL7zVg cardBody_BHLlhQ",
  actions: "actions_FL7zVg actions_BHLlhQ",
  btn: "btn_FL7zVg btn_BHLlhQ",
  btnGhost: "btnGhost_FL7zVg btnGhost_BHLlhQ",
  btnDanger: "btnDanger_FL7zVg btnDanger_BHLlhQ",
  status: "status_FL7zVg status_BHLlhQ",
  dot: "dot_FL7zVg dot_BHLlhQ",
  busy: "dotBusy_FL7zVg busy_BHLlhQ",
  chip: "chip_FL7zVg chip_BHLlhQ",
  on: "on_BHLlhQ",
  behindWrap: "behindWrap_BHLlhQ",
  behindNum: "behindNum_BHLlhQ",
  behindText: "behindText_BHLlhQ",
  behindPair: "behindPair_BHLlhQ",
  cur: "cur_BHLlhQ",
  lat: "lat_BHLlhQ",
  tl: "tl_BHLlhQ",
  ver: "ver_BHLlhQ",
  here: "here_BHLlhQ",
  vtag: "vtag_BHLlhQ",
  vbody: "vbody_BHLlhQ",
  vact: "vact_BHLlhQ",
  hereMark: "hereMark_BHLlhQ",
  vname: "vname_BHLlhQ",
  cm: "cm_BHLlhQ",
  vmeta: "vmeta_BHLlhQ",
  rel: "rel_BHLlhQ",
  ahead: "ahead_BHLlhQ",
  behind: "behind_BHLlhQ",
  chipNow: "chip_FL7zVg chip_BHLlhQ chipNow_BHLlhQ",
  caret: "caret_BHLlhQ",
  noLog: "noLog_BHLlhQ",
  log: "log_BHLlhQ",
  c: "c_BHLlhQ",
  h: "h_BHLlhQ",
  s: "s_BHLlhQ",
  overlay: "overlay_BHLlhQ",
  popup: "popup_BHLlhQ",
  jump: "jump_BHLlhQ",
  arrow: "arrow_BHLlhQ",
  warnNote: "warnNote_BHLlhQ",
  badge: "badge_BHLlhQ",
  badgeOk: "badgeOk_BHLlhQ",
  badgeBad: "badgeBad_BHLlhQ",
  big: "big_BHLlhQ",
  sub: "sub_BHLlhQ",
  actionsCenter: "actionsCenter_BHLlhQ"
};

// src/ui/apps/settings/sections/updates-dialogs.tsx
import { jsxDEV as jsxDEV14, Fragment as Fragment9 } from "react/jsx-dev-runtime";
function Modal({ children }) {
  return /* @__PURE__ */ jsxDEV14("div", {
    className: updates_module_default.overlay,
    children: /* @__PURE__ */ jsxDEV14("div", {
      className: updates_module_default.popup,
      children
    }, undefined, false, undefined, this)
  }, undefined, false, undefined, this);
}
var CheckIcon = () => /* @__PURE__ */ jsxDEV14("svg", {
  width: "26",
  height: "26",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "3.2",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": "true",
  children: /* @__PURE__ */ jsxDEV14("path", {
    d: "M20 6L9 17l-5-5"
  }, undefined, false, undefined, this)
}, undefined, false, undefined, this);
var XIcon = () => /* @__PURE__ */ jsxDEV14("svg", {
  width: "26",
  height: "26",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "3.2",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": "true",
  children: /* @__PURE__ */ jsxDEV14("path", {
    d: "M18 6L6 18M6 6l12 12"
  }, undefined, false, undefined, this)
}, undefined, false, undefined, this);
function ConfirmSwitch({
  installed,
  target,
  kind,
  onConfirm,
  onCancel
}) {
  const rollback = kind === "rollback";
  const noPopupAfter = rollback && !isFeatureAware(target);
  return /* @__PURE__ */ jsxDEV14(Modal, {
    children: /* @__PURE__ */ jsxDEV14(Fragment9, {
      children: [
        /* @__PURE__ */ jsxDEV14("div", {
          className: updates_module_default.cardTitle,
          children: rollback ? `Roll back to ${target}?` : `Update to ${target}?`
        }, undefined, false, undefined, this),
        /* @__PURE__ */ jsxDEV14("div", {
          className: updates_module_default.jump,
          children: [
            installed,
            " ",
            /* @__PURE__ */ jsxDEV14("span", {
              className: updates_module_default.arrow,
              children: "→"
            }, undefined, false, undefined, this),
            " ",
            target
          ]
        }, undefined, true, undefined, this),
        noPopupAfter && /* @__PURE__ */ jsxDEV14("div", {
          className: updates_module_default.warnNote,
          children: [
            target,
            " is older than this Updates screen. After the restart it will not show a confirmation or an Undo button, so ",
            /* @__PURE__ */ jsxDEV14("b", {
              children: "this screen is your receipt"
            }, undefined, false, undefined, this),
            "."
          ]
        }, undefined, true, undefined, this),
        /* @__PURE__ */ jsxDEV14("div", {
          className: updates_module_default.cardBody,
          children: "Your studio folder (pieces, settings, keys) is never touched, only the program changes. Hoplight restarts itself when it is ready."
        }, undefined, false, undefined, this),
        /* @__PURE__ */ jsxDEV14("div", {
          className: updates_module_default.actions,
          children: [
            /* @__PURE__ */ jsxDEV14("button", {
              type: "button",
              className: rollback ? `${updates_module_default.btn} ${updates_module_default.btnDanger}` : updates_module_default.btn,
              onClick: onConfirm,
              children: rollback ? "Roll back" : "Update"
            }, undefined, false, undefined, this),
            /* @__PURE__ */ jsxDEV14("button", {
              type: "button",
              className: updates_module_default.btnGhost,
              onClick: onCancel,
              children: "Cancel"
            }, undefined, false, undefined, this)
          ]
        }, undefined, true, undefined, this)
      ]
    }, undefined, true, undefined, this)
  }, undefined, false, undefined, this);
}
function SwitchProgress({ message }) {
  return /* @__PURE__ */ jsxDEV14(Modal, {
    children: /* @__PURE__ */ jsxDEV14(Fragment9, {
      children: [
        /* @__PURE__ */ jsxDEV14("div", {
          className: updates_module_default.cardTitle,
          children: "Switching version"
        }, undefined, false, undefined, this),
        /* @__PURE__ */ jsxDEV14("span", {
          className: updates_module_default.status,
          children: [
            /* @__PURE__ */ jsxDEV14("span", {
              className: `${updates_module_default.dot} ${updates_module_default.busy}`
            }, undefined, false, undefined, this),
            message || "Working..."
          ]
        }, undefined, true, undefined, this),
        /* @__PURE__ */ jsxDEV14("div", {
          className: updates_module_default.cardBody,
          children: "Do not close Hoplight. It restarts itself when the switch is ready."
        }, undefined, false, undefined, this)
      ]
    }, undefined, true, undefined, this)
  }, undefined, false, undefined, this);
}
function SwitchResult({
  outcome,
  onDone,
  onUndo
}) {
  if (outcome.kind === "success") {
    return /* @__PURE__ */ jsxDEV14(Modal, {
      children: /* @__PURE__ */ jsxDEV14(Fragment9, {
        children: [
          /* @__PURE__ */ jsxDEV14("div", {
            className: `${updates_module_default.badge} ${updates_module_default.badgeOk}`,
            children: /* @__PURE__ */ jsxDEV14(CheckIcon, {}, undefined, false, undefined, this)
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV14("div", {
            className: updates_module_default.big,
            children: [
              "You are now on ",
              outcome.to
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ jsxDEV14("div", {
            className: updates_module_default.sub,
            children: "Done. Everything is ready."
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV14("div", {
            className: updates_module_default.actionsCenter,
            children: [
              /* @__PURE__ */ jsxDEV14("button", {
                type: "button",
                className: updates_module_default.btn,
                onClick: onDone,
                children: "Done"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV14("button", {
                type: "button",
                className: updates_module_default.btnGhost,
                onClick: () => onUndo(outcome.from),
                children: [
                  "Undo, back to ",
                  outcome.from
                ]
              }, undefined, true, undefined, this)
            ]
          }, undefined, true, undefined, this)
        ]
      }, undefined, true, undefined, this)
    }, undefined, false, undefined, this);
  }
  if (outcome.kind === "failed") {
    return /* @__PURE__ */ jsxDEV14(Modal, {
      children: /* @__PURE__ */ jsxDEV14(Fragment9, {
        children: [
          /* @__PURE__ */ jsxDEV14("div", {
            className: `${updates_module_default.badge} ${updates_module_default.badgeBad}`,
            children: /* @__PURE__ */ jsxDEV14(XIcon, {}, undefined, false, undefined, this)
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV14("div", {
            className: updates_module_default.big,
            children: [
              "Still on ",
              outcome.from
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ jsxDEV14("div", {
            className: updates_module_default.sub,
            children: [
              "The switch to ",
              outcome.to,
              " did not complete, so nothing changed. Your app is exactly as it was."
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ jsxDEV14("div", {
            className: updates_module_default.actionsCenter,
            children: /* @__PURE__ */ jsxDEV14("button", {
              type: "button",
              className: updates_module_default.btn,
              onClick: onDone,
              children: "OK"
            }, undefined, false, undefined, this)
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this)
    }, undefined, false, undefined, this);
  }
  return null;
}

// src/ui/apps/settings/sections/updates.tsx
import { jsxDEV as jsxDEV15, Fragment as Fragment10 } from "react/jsx-dev-runtime";
function BehindCard({ tl }) {
  if (!tl.installedInList) {
    return /* @__PURE__ */ jsxDEV15("div", {
      className: updates_module_default.card,
      children: [
        /* @__PURE__ */ jsxDEV15("div", {
          className: updates_module_default.cardTitle,
          children: "You are on an unreleased build"
        }, undefined, false, undefined, this),
        /* @__PURE__ */ jsxDEV15("div", {
          className: updates_module_default.cardBody,
          children: [
            "Your version (",
            tl.installed,
            ") is not one of the published releases, it sits between them (a source build). The timeline below still shows every release you can move to."
          ]
        }, undefined, true, undefined, this)
      ]
    }, undefined, true, undefined, this);
  }
  if (tl.behind === 0) {
    return /* @__PURE__ */ jsxDEV15("div", {
      className: updates_module_default.card,
      children: [
        /* @__PURE__ */ jsxDEV15("div", {
          className: updates_module_default.cardTitle,
          children: /* @__PURE__ */ jsxDEV15("span", {
            className: updates_module_default.status,
            children: [
              /* @__PURE__ */ jsxDEV15("span", {
                className: `${updates_module_default.dot} ${updates_module_default.on}`
              }, undefined, false, undefined, this),
              "Up to date"
            ]
          }, undefined, true, undefined, this)
        }, undefined, false, undefined, this),
        /* @__PURE__ */ jsxDEV15("div", {
          className: updates_module_default.cardBody,
          children: [
            "You are on ",
            tl.installed,
            ", the newest release. The timeline below still lets you look back."
          ]
        }, undefined, true, undefined, this)
      ]
    }, undefined, true, undefined, this);
  }
  const n = tl.behind + (tl.hasMore ? "+" : "");
  return /* @__PURE__ */ jsxDEV15("div", {
    className: `${updates_module_default.card} ${updates_module_default.hero}`,
    children: [
      /* @__PURE__ */ jsxDEV15("div", {
        className: updates_module_default.cardTitle,
        children: "Your version"
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV15("div", {
        className: updates_module_default.behindWrap,
        children: [
          /* @__PURE__ */ jsxDEV15("div", {
            className: updates_module_default.behindNum,
            children: n
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV15("div", {
            className: updates_module_default.behindText,
            children: [
              /* @__PURE__ */ jsxDEV15("div", {
                children: tl.behind === 1 && !tl.hasMore ? "release behind the newest" : "releases behind the newest"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV15("div", {
                className: updates_module_default.behindPair,
                children: [
                  "you are on ",
                  /* @__PURE__ */ jsxDEV15("span", {
                    className: updates_module_default.cur,
                    children: tl.installed
                  }, undefined, false, undefined, this),
                  " · newest is",
                  " ",
                  /* @__PURE__ */ jsxDEV15("span", {
                    className: updates_module_default.lat,
                    children: tl.latest
                  }, undefined, false, undefined, this)
                ]
              }, undefined, true, undefined, this)
            ]
          }, undefined, true, undefined, this)
        ]
      }, undefined, true, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
var relLabel = (row) => {
  if (row.relation === "here")
    return "your current version";
  const unit = row.distance === 1 ? "release" : "releases";
  return row.relation === "ahead" ? `${row.distance} ${unit} ahead of you` : `${row.distance} ${unit} behind you`;
};
function VersionRow({
  row,
  onSwitch
}) {
  const [open, setOpen] = useState13(false);
  const r = row.release;
  const commits = r.commits;
  const action = row.relation === "here" ? null : row.relation === "ahead" ? "Update to this" : "Roll back to this";
  return /* @__PURE__ */ jsxDEV15("div", {
    className: `${updates_module_default.ver} ${row.relation === "here" ? updates_module_default.here : ""}`,
    children: [
      /* @__PURE__ */ jsxDEV15("span", {
        className: updates_module_default.vtag,
        children: r.version
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV15("div", {
        className: updates_module_default.vbody,
        children: [
          /* @__PURE__ */ jsxDEV15("div", {
            className: updates_module_default.vname,
            children: [
              row.relation === "here" && /* @__PURE__ */ jsxDEV15("span", {
                className: `${updates_module_default.chip} ${updates_module_default.chipNow}`,
                children: "you are here"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV15("span", {
                className: updates_module_default.cm,
                children: r.headline || r.name
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this),
          /* @__PURE__ */ jsxDEV15("div", {
            className: updates_module_default.vmeta,
            children: [
              /* @__PURE__ */ jsxDEV15("span", {
                className: `${updates_module_default.rel} ${updates_module_default[row.relation]}`,
                children: relLabel(row)
              }, undefined, false, undefined, this),
              r.date && /* @__PURE__ */ jsxDEV15("span", {
                children: [
                  "· ",
                  new Date(r.date).toLocaleDateString()
                ]
              }, undefined, true, undefined, this),
              /* @__PURE__ */ jsxDEV15("span", {
                children: [
                  "· ",
                  commits.length === 1 ? "1 commit" : `${commits.length} commits`
                ]
              }, undefined, true, undefined, this)
            ]
          }, undefined, true, undefined, this),
          commits.length > 0 ? /* @__PURE__ */ jsxDEV15("button", {
            type: "button",
            className: updates_module_default.caret,
            onClick: () => setOpen((v) => !v),
            children: [
              open ? "Hide" : "Show",
              " the ",
              commits.length === 1 ? "commit" : `${commits.length} commits`
            ]
          }, undefined, true, undefined, this) : /* @__PURE__ */ jsxDEV15("div", {
            className: updates_module_default.noLog,
            children: "commit log unavailable for this release"
          }, undefined, false, undefined, this),
          open && commits.length > 0 && /* @__PURE__ */ jsxDEV15("div", {
            className: updates_module_default.log,
            children: commits.map((c) => /* @__PURE__ */ jsxDEV15("div", {
              className: updates_module_default.c,
              children: [
                /* @__PURE__ */ jsxDEV15("span", {
                  className: updates_module_default.h,
                  children: c.hash
                }, undefined, false, undefined, this),
                /* @__PURE__ */ jsxDEV15("span", {
                  className: updates_module_default.s,
                  children: c.subject
                }, undefined, false, undefined, this)
              ]
            }, c.hash, true, undefined, this))
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      /* @__PURE__ */ jsxDEV15("div", {
        className: updates_module_default.vact,
        children: action ? /* @__PURE__ */ jsxDEV15("button", {
          type: "button",
          className: updates_module_default.btnGhost,
          onClick: () => onSwitch(r.version),
          children: action
        }, undefined, false, undefined, this) : /* @__PURE__ */ jsxDEV15("span", {
          className: updates_module_default.hereMark,
          children: "current"
        }, undefined, false, undefined, this)
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
function UpdatesSection({ ctx }) {
  const [phase, setPhase] = useState13({ state: "loading" });
  const [installed, setInstalled] = useState13("");
  const [confirm, setConfirm] = useState13(null);
  const [switching, setSwitching] = useState13(null);
  const [result, setResult] = useState13(null);
  const [switchError, setSwitchError] = useState13(null);
  const [manualDone, setManualDone] = useState13(null);
  useEffect10(() => {
    let alive = true;
    (async () => {
      try {
        const [ver, rel] = await Promise.all([ctx.api.version(), ctx.api.updatesReleases(1)]);
        if (!alive)
          return;
        setInstalled(ver.version);
        if (rel.httpStatus === 403 || rel.httpStatus === 429) {
          setPhase({ state: "rate-limited", retryAfterSec: rel.retryAfterSec ?? 0 });
          return;
        }
        if (rel.httpStatus !== 200 || !Array.isArray(rel.body)) {
          setPhase({ state: "error" });
          return;
        }
        const releases = readReleasesList(rel.body);
        setPhase({ state: "ready", timeline: buildTimeline(releases, ver.version, rel.hasMore) });
      } catch {
        if (alive)
          setPhase({ state: "error" });
      }
    })();
    return () => {
      alive = false;
    };
  }, [ctx]);
  useEffect10(() => {
    let alive = true;
    (async () => {
      try {
        const [{ version }, { marker }] = await Promise.all([ctx.api.version(), ctx.api.switchPending()]);
        if (!alive || !marker)
          return;
        const outcome = reducePendingSwitch(marker, version, Date.now());
        if (outcome.kind !== "none")
          setResult(outcome);
      } catch {}
    })();
    return () => {
      alive = false;
    };
  }, [ctx]);
  const onSwitch = (target) => {
    const kind = switchKind(installed, target);
    if (kind === "current")
      return;
    setConfirm({ target, kind });
  };
  const reconnectAndReload = () => {
    const started = Date.now();
    const poll = async () => {
      if (Date.now() - started > 60000) {
        setSwitching(null);
        setSwitchError("Hoplight did not come back on its own. Start it again from your shortcut.");
        return;
      }
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (res.ok) {
          location.reload();
          return;
        }
      } catch {}
      setTimeout(() => void poll(), 800);
    };
    setTimeout(() => void poll(), 1500);
  };
  const pollStatus = () => {
    const id = setInterval(async () => {
      try {
        const s = await ctx.api.switchStatus();
        if (s.phase === "working")
          setSwitching(s.message || "Working...");
        else if (s.phase === "restarting") {
          clearInterval(id);
          setSwitching("Restarting Hoplight...");
          reconnectAndReload();
        } else if (s.phase === "manual") {
          clearInterval(id);
          setSwitching(null);
          setManualDone(s.message);
        } else if (s.phase === "failed") {
          clearInterval(id);
          setSwitching(null);
          setSwitchError(s.message);
        }
      } catch {
        clearInterval(id);
        reconnectAndReload();
      }
    }, 1000);
  };
  const doSwitch = async (target) => {
    setConfirm(null);
    setSwitchError(null);
    setSwitching("Starting...");
    try {
      await ctx.api.switchTo(target);
    } catch (e) {
      setSwitching(null);
      setSwitchError(e instanceof Error ? e.message : "Could not start the switch.");
      return;
    }
    pollStatus();
  };
  return /* @__PURE__ */ jsxDEV15("div", {
    className: updates_module_default.wrap,
    children: [
      /* @__PURE__ */ jsxDEV15("div", {
        children: [
          /* @__PURE__ */ jsxDEV15("div", {
            className: updates_module_default.title,
            children: "Updates"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV15("div", {
            className: updates_module_default.blurb,
            children: "Every release, newest first, with what changed in each. See how far behind you are and read the full commit log for any version. Checks GitHub only when you open this page."
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      phase.state === "loading" && /* @__PURE__ */ jsxDEV15("div", {
        className: updates_module_default.card,
        children: /* @__PURE__ */ jsxDEV15("span", {
          className: updates_module_default.status,
          children: [
            /* @__PURE__ */ jsxDEV15("span", {
              className: `${updates_module_default.dot} ${updates_module_default.busy}`
            }, undefined, false, undefined, this),
            "Asking GitHub for the release history..."
          ]
        }, undefined, true, undefined, this)
      }, undefined, false, undefined, this),
      phase.state === "rate-limited" && /* @__PURE__ */ jsxDEV15("div", {
        className: updates_module_default.card,
        children: [
          /* @__PURE__ */ jsxDEV15("div", {
            className: updates_module_default.cardTitle,
            children: "Checked too often"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV15("div", {
            className: updates_module_default.cardBody,
            children: [
              "GitHub limits how often the release history can be fetched.",
              " ",
              phase.retryAfterSec > 0 ? `Try again in about ${Math.ceil(phase.retryAfterSec / 60)} minute(s).` : "Try again shortly."
            ]
          }, undefined, true, undefined, this)
        ]
      }, undefined, true, undefined, this),
      phase.state === "error" && /* @__PURE__ */ jsxDEV15("div", {
        className: updates_module_default.card,
        children: [
          /* @__PURE__ */ jsxDEV15("div", {
            className: updates_module_default.cardTitle,
            children: "Could not load the release history"
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV15("div", {
            className: updates_module_default.cardBody,
            children: "GitHub could not be reached. Nothing else is affected."
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV15("div", {
            className: updates_module_default.actions,
            children: /* @__PURE__ */ jsxDEV15("button", {
              type: "button",
              className: updates_module_default.btnGhost,
              onClick: () => requestExternal(RELEASES_PAGE, "Hoplight releases"),
              children: "Open releases on GitHub"
            }, undefined, false, undefined, this)
          }, undefined, false, undefined, this)
        ]
      }, undefined, true, undefined, this),
      phase.state === "ready" && /* @__PURE__ */ jsxDEV15(Fragment10, {
        children: [
          /* @__PURE__ */ jsxDEV15(BehindCard, {
            tl: phase.timeline
          }, undefined, false, undefined, this),
          /* @__PURE__ */ jsxDEV15("div", {
            className: updates_module_default.card,
            children: [
              /* @__PURE__ */ jsxDEV15("div", {
                className: updates_module_default.cardTitle,
                children: "All releases"
              }, undefined, false, undefined, this),
              /* @__PURE__ */ jsxDEV15("div", {
                className: updates_module_default.tl,
                children: [
                  phase.timeline.rows.map((row) => /* @__PURE__ */ jsxDEV15(VersionRow, {
                    row,
                    onSwitch
                  }, row.release.version, false, undefined, this)),
                  phase.timeline.rows.length === 0 && /* @__PURE__ */ jsxDEV15("div", {
                    className: updates_module_default.cardBody,
                    children: "No published releases yet."
                  }, undefined, false, undefined, this)
                ]
              }, undefined, true, undefined, this),
              /* @__PURE__ */ jsxDEV15("div", {
                className: updates_module_default.actions,
                children: /* @__PURE__ */ jsxDEV15("button", {
                  type: "button",
                  className: updates_module_default.btnGhost,
                  onClick: () => requestExternal(RELEASES_PAGE, "Hoplight releases"),
                  children: "Open releases on GitHub"
                }, undefined, false, undefined, this)
              }, undefined, false, undefined, this)
            ]
          }, undefined, true, undefined, this)
        ]
      }, undefined, true, undefined, this),
      confirm && /* @__PURE__ */ jsxDEV15(ConfirmSwitch, {
        installed,
        target: confirm.target,
        kind: confirm.kind,
        onConfirm: () => void doSwitch(confirm.target),
        onCancel: () => setConfirm(null)
      }, undefined, false, undefined, this),
      switching !== null && /* @__PURE__ */ jsxDEV15(SwitchProgress, {
        message: switching
      }, undefined, false, undefined, this),
      result && /* @__PURE__ */ jsxDEV15(SwitchResult, {
        outcome: result,
        onDone: () => setResult(null),
        onUndo: (from) => {
          setResult(null);
          doSwitch(from);
        }
      }, undefined, false, undefined, this),
      switchError && /* @__PURE__ */ jsxDEV15("div", {
        className: updates_module_default.overlay,
        children: /* @__PURE__ */ jsxDEV15("div", {
          className: updates_module_default.popup,
          children: [
            /* @__PURE__ */ jsxDEV15("div", {
              className: updates_module_default.cardTitle,
              children: "Could not switch"
            }, undefined, false, undefined, this),
            /* @__PURE__ */ jsxDEV15("div", {
              className: updates_module_default.sub,
              children: switchError
            }, undefined, false, undefined, this),
            /* @__PURE__ */ jsxDEV15("div", {
              className: updates_module_default.actionsCenter,
              children: /* @__PURE__ */ jsxDEV15("button", {
                type: "button",
                className: updates_module_default.btn,
                onClick: () => setSwitchError(null),
                children: "OK"
              }, undefined, false, undefined, this)
            }, undefined, false, undefined, this)
          ]
        }, undefined, true, undefined, this)
      }, undefined, false, undefined, this),
      manualDone && /* @__PURE__ */ jsxDEV15("div", {
        className: updates_module_default.overlay,
        children: /* @__PURE__ */ jsxDEV15("div", {
          className: updates_module_default.popup,
          children: [
            /* @__PURE__ */ jsxDEV15("div", {
              className: updates_module_default.cardTitle,
              children: "Download ready"
            }, undefined, false, undefined, this),
            /* @__PURE__ */ jsxDEV15("div", {
              className: updates_module_default.sub,
              children: manualDone
            }, undefined, false, undefined, this),
            /* @__PURE__ */ jsxDEV15("div", {
              className: updates_module_default.actionsCenter,
              children: /* @__PURE__ */ jsxDEV15("button", {
                type: "button",
                className: updates_module_default.btn,
                onClick: () => setManualDone(null),
                children: "OK"
              }, undefined, false, undefined, this)
            }, undefined, false, undefined, this)
          ]
        }, undefined, true, undefined, this)
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
var section7 = {
  id: "updates",
  label: "Updates",
  order: 88,
  Component: UpdatesSection
};
var updates_default = section7;

// src/ui/apps/settings/sections/workbench.tsx
import { useState as useState14 } from "react";
import { jsxDEV as jsxDEV16, Fragment as Fragment11 } from "react/jsx-dev-runtime";
var PREF_LAYOUT = "editor.layout";
var PREF_MODE = "editor.mode";
var PREF_AUTOSAVE = "workbench.autosave";
var PREF_RESTORE = "workbench.restoreSession";
function WorkbenchSection({ ctx }) {
  const [follow, setFollow] = useState14(() => {
    const f = ctx.prefs.get(SETTING_KEYS.workbenchFollow);
    return f === "always" || f === "never" ? f : "ask";
  });
  const [layout, setLayout] = useState14(() => ctx.prefs.get(PREF_LAYOUT) === "playbill" ? "playbill" : "bento");
  const [mode, setMode] = useState14(() => ctx.prefs.get(PREF_MODE) === "grid" ? "grid" : "interview");
  const [autosave, setAutosave] = useState14(() => ctx.prefs.get(PREF_AUTOSAVE) === true);
  const [restore, setRestore] = useState14(() => ctx.prefs.get(PREF_RESTORE) === true);
  return /* @__PURE__ */ jsxDEV16(Fragment11, {
    children: [
      /* @__PURE__ */ jsxDEV16(SettingsRow, {
        label: "Autosave",
        hint: "Save half a second after you stop typing. Ctrl+S still works, and still saves at once.",
        children: /* @__PURE__ */ jsxDEV16(SegControl, {
          options: [
            { value: "off", label: "Off" },
            { value: "on", label: "On" }
          ],
          current: autosave ? "on" : "off",
          onPick: (v) => {
            ctx.prefs.set(PREF_AUTOSAVE, v === "on");
            setAutosave(v === "on");
          }
        }, undefined, false, undefined, this)
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV16(SettingsRow, {
        label: "Reopen where you left off",
        hint: "Restore the pieces you had open, and which one you were editing, after a restart or a crash.",
        children: /* @__PURE__ */ jsxDEV16(SegControl, {
          options: [
            { value: "off", label: "Off" },
            { value: "on", label: "On" }
          ],
          current: restore ? "on" : "off",
          onPick: (v) => {
            ctx.prefs.set(PREF_RESTORE, v === "on");
            setRestore(v === "on");
          }
        }, undefined, false, undefined, this)
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV16(SettingsRow, {
        label: "Editor layout",
        hint: "Bento shows every field at once; Playbill turns them into acts you page through.",
        children: /* @__PURE__ */ jsxDEV16(SegControl, {
          options: [
            { value: "bento", label: "Bento" },
            { value: "playbill", label: "Playbill" }
          ],
          current: layout,
          onPick: (v) => {
            ctx.prefs.set(PREF_LAYOUT, v);
            setLayout(v);
          }
        }, undefined, false, undefined, this)
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV16(SettingsRow, {
        label: "How you fill it in",
        hint: "Grid shows every field to edit directly; Steps walks you through like a quiz.",
        children: /* @__PURE__ */ jsxDEV16(SegControl, {
          options: [
            { value: "grid", label: "Grid" },
            { value: "interview", label: "Steps" }
          ],
          current: mode,
          onPick: (v) => {
            ctx.prefs.set(PREF_MODE, v);
            setMode(v);
          }
        }, undefined, false, undefined, this)
      }, undefined, false, undefined, this),
      /* @__PURE__ */ jsxDEV16(SettingsRow, {
        label: "After sending a piece",
        hint: "Follow it to the Workbench, stay where you are, or ask every time.",
        children: /* @__PURE__ */ jsxDEV16(SegControl, {
          options: [
            { value: "ask", label: "Ask me" },
            { value: "always", label: "Always follow" },
            { value: "never", label: "Stay" }
          ],
          current: follow,
          onPick: (v) => {
            ctx.prefs.set(SETTING_KEYS.workbenchFollow, v);
            setFollow(v);
          }
        }, undefined, false, undefined, this)
      }, undefined, false, undefined, this)
    ]
  }, undefined, true, undefined, this);
}
var section8 = {
  id: "workbench",
  label: "Workbench",
  order: 30,
  Component: WorkbenchSection
};
var workbench_default = section8;

// src/ui/apps/settings/sections/registry.ts
var SECTIONS = [appearance_default, models_default, connections_default, studio_default, workbench_default, remote_access_default, updates_default, about_default];
var settingsSections = () => [...SECTIONS].sort((a, b) => a.order - b.order);

// src/ui/apps/settings/agent-surface.ts
import { useEffect as useEffect11, useRef as useRef3 } from "react";
var SETTINGS_AGENT_SURFACE = {
  describe: "Where the studio is configured, one tab per area: appearance, the studio folder, workbench " + "behaviour, remote access, updates, and about. Secrets shown on these tabs are never described " + "to an agent.",
  actions: [
    {
      id: "explain-setting",
      label: "Explain a setting",
      describe: "Say in plain words what one of these settings changes, before it gets changed."
    },
    {
      id: "find-setting",
      label: "Find the right tab",
      describe: "Say which tab holds the thing somebody is looking for, without guessing at its value."
    }
  ]
};
var str2 = (v) => typeof v === "string" ? v : "";
function readSettingsSurface(get, tabs, activeId) {
  const targets = get(SETTING_KEYS.publishTargets);
  return {
    tabs,
    activeId,
    theme: str2(get(SETTING_KEYS.theme)),
    houseAccentSet: str2(get(SETTING_KEYS.houseAccent)) !== "",
    homeApp: str2(get(SETTING_KEYS.homeApp)),
    firstDeck: str2(get(SETTING_KEYS.firstDeck)),
    publishTargets: Array.isArray(targets) ? targets.filter((t) => typeof t === "string") : [],
    remoteAccessOn: get(SETTING_KEYS.remoteAccessEnabled) === true
  };
}
function settingsAgentState(input) {
  const active = input.tabs.find((t) => t.id === input.activeId);
  const notes = [];
  notes.push(input.theme === "" ? "The theme has never been set, so the studio is on its default." : `The theme is ${input.theme}.`);
  notes.push(input.houseAccentSet ? "A house accent has been chosen. Its value is a colour and is not reported here." : "No house accent has been chosen.");
  if (input.homeApp !== "")
    notes.push(`The studio opens on ${input.homeApp}.`);
  if (input.firstDeck !== "")
    notes.push(`The Library opens on the ${input.firstDeck} deck.`);
  notes.push(input.publishTargets.length > 0 ? `Publish targets picked at setup: ${input.publishTargets.join(", ")}.` : "No publish targets were picked at setup, so every format stays available.");
  notes.push(input.remoteAccessOn ? "Remote access is on. The connect code, address and fingerprint that go with it are on this " + "screen and are deliberately not described." : "Remote access is off.");
  notes.push("No provider key, token or vault content appears on this screen or in this description. " + "Whether a model is connected is not configured here.");
  return {
    headline: active ? `Settings, on the ${active.label} tab.` : "Settings, with no tab selected.",
    items: input.tabs.map((t) => ({
      kind: "settings-tab",
      id: t.id,
      name: t.label,
      ...t.id === input.activeId ? { focused: true } : {}
    })),
    notes
  };
}
function usePublishSettingsSurface(ctx, input) {
  const { tabs, activeId, theme, houseAccentSet, homeApp, firstDeck, publishTargets, remoteAccessOn } = readSettingsSurface((key) => ctx.prefs.get(key), input.tabs, input.activeId);
  const tabsKey = tabs.map((t) => t.id).join(",");
  const targetsKey = publishTargets.join(",");
  const ctxRef = useRef3(ctx);
  ctxRef.current = ctx;
  useEffect11(() => {
    ctxRef.current.agent.publish(settingsAgentState({
      tabs,
      activeId,
      theme,
      houseAccentSet,
      homeApp,
      firstDeck,
      publishTargets,
      remoteAccessOn
    }));
  }, [tabsKey, targetsKey, activeId, theme, houseAccentSet, homeApp, firstDeck, remoteAccessOn]);
}

// src/ui/apps/settings/index.tsx
import { jsxDEV as jsxDEV17 } from "react/jsx-dev-runtime";
var MARK_SVG = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">' + '<circle cx="12" cy="12" r="3"/>' + '<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>' + "</svg>";
function SettingsRoom({ ctx }) {
  const sections = settingsSections();
  const launch = parseLaunchTarget(window.location.hash);
  const requestedId = launch?.appId === "settings" ? launch.sectionId : undefined;
  const initialId = sections.some((section9) => section9.id === requestedId) ? requestedId : sections[0]?.id ?? "";
  const [activeId, setActiveId] = useState15(initialId);
  const active = sections.find((s) => s.id === activeId) ?? sections[0];
  useEffect12(() => {
    const section9 = sections.find((s) => s.id === activeId) ?? sections[0];
    if (section9)
      ctx.setStatus(section9.label.toLowerCase());
  }, [ctx, activeId, sections]);
  usePublishSettingsSurface(ctx, {
    tabs: sections.map((s) => ({ id: s.id, label: s.label })),
    activeId: active?.id ?? ""
  });
  if (!active)
    return null;
  const ActiveSection = active.Component;
  return /* @__PURE__ */ jsxDEV17("div", {
    className: styles_module_default.roomHost,
    children: /* @__PURE__ */ jsxDEV17("div", {
      className: styles_module_default.room,
      children: [
        /* @__PURE__ */ jsxDEV17("div", {
          className: styles_module_default.tabs,
          children: sections.map((s) => /* @__PURE__ */ jsxDEV17("button", {
            type: "button",
            className: s.id === active.id ? `${styles_module_default.tab} ${styles_module_default.on}` : styles_module_default.tab,
            onClick: () => setActiveId(s.id),
            children: s.label
          }, s.id, false, undefined, this))
        }, undefined, false, undefined, this),
        /* @__PURE__ */ jsxDEV17("div", {
          className: styles_module_default.body,
          children: /* @__PURE__ */ jsxDEV17(ActiveSection, {
            ctx
          }, undefined, false, undefined, this)
        }, undefined, false, undefined, this)
      ]
    }, undefined, true, undefined, this)
  }, undefined, false, undefined, this);
}
var app = {
  manifest: {
    id: "settings",
    title: "Settings",
    markSvg: MARK_SVG,
    accent: "#8a8496",
    order: 100,
    subtitle: "app",
    dockFoot: true,
    agentSurface: SETTINGS_AGENT_SURFACE
  },
  Component: SettingsRoom
};
var settings_default = app;
export {
  settings_default as default
};
