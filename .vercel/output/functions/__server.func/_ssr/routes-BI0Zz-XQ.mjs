import { i as __toESM } from "../_runtime.mjs";
import { K as require_react, b as require_jsx_runtime } from "../_libs/@tanstack/react-router+[...].mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-BI0Zz-XQ.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function Home() {
	(0, import_react.useEffect)(() => {
		if (document.querySelector("script[data-machine]")) return;
		const script = document.createElement("script");
		script.type = "module";
		script.src = "/machine.js";
		script.dataset.machine = "1";
		document.body.appendChild(script);
	}, []);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("main", {
		className: "machine-shell",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { id: "view" }),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "title",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", { children: "电动木质滚珠机" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					id: "status",
					children: "正在装配机构…"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				id: "hud",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "bar",
					role: "toolbar",
					"aria-label": "仿真控制",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "group",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
								id: "btn-play",
								type: "button",
								"aria-pressed": "true",
								children: "暂停"
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "sep" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "group",
							role: "group",
							"aria-label": "速度",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									"data-speed": "0.5",
									children: "0.5×"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									"data-speed": "1",
									"aria-pressed": "true",
									children: "1×"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									"data-speed": "2",
									children: "2×"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "sep" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "group",
							role: "group",
							"aria-label": "钢珠数量",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									"data-count": "4",
									children: "4 颗"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									"data-count": "8",
									"aria-pressed": "true",
									children: "8 颗"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									"data-count": "12",
									children: "12 颗"
								})
							]
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "sep" }),
						/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "group",
							role: "group",
							"aria-label": "视角",
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									"data-view": "wide",
									"aria-pressed": "true",
									children: "全景"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									"data-view": "top",
									children: "俯视"
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
									type: "button",
									"data-view": "gears",
									children: "齿轮"
								})
							]
						})
					]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				id: "loading",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "card",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "电动木质滚珠机" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { children: "正在装配齿轮、链条与轨道…" })]
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				id: "error",
				role: "alert",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "card",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { children: "三维场景加载失败" }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						id: "error-text",
						children: "无法加载三维组件库。请刷新页面重试。"
					})]
				})
			})
		]
	});
}
//#endregion
export { Home as component };
