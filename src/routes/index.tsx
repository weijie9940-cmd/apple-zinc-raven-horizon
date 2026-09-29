import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  useEffect(() => {
    if (document.querySelector("script[data-machine]")) return;
    const script = document.createElement("script");
    script.type = "module";
    script.src = "/machine.js";
    script.dataset.machine = "1";
    document.body.appendChild(script);
  }, []);

  return (
    <main className="machine-shell">
      <div id="view" />
      <header className="title">
        <h1>电动木质滚珠机</h1>
        <p id="status">正在装配机构…</p>
      </header>
      <div id="hud">
        <div className="bar" role="toolbar" aria-label="仿真控制">
          <div className="group">
            <button id="btn-play" type="button" aria-pressed="true">
              暂停
            </button>
          </div>
          <div className="sep" />
          <div className="group" role="group" aria-label="速度">
            <button type="button" data-speed="0.5">
              0.5×
            </button>
            <button type="button" data-speed="1" aria-pressed="true">
              1×
            </button>
            <button type="button" data-speed="2">
              2×
            </button>
          </div>
          <div className="sep" />
          <div className="group" role="group" aria-label="钢珠数量">
            <button type="button" data-count="4">
              4 颗
            </button>
            <button type="button" data-count="8" aria-pressed="true">
              8 颗
            </button>
            <button type="button" data-count="12">
              12 颗
            </button>
          </div>
          <div className="sep" />
          <div className="group" role="group" aria-label="视角">
            <button type="button" data-view="wide" aria-pressed="true">
              全景
            </button>
            <button type="button" data-view="top">
              俯视
            </button>
            <button type="button" data-view="gears">
              齿轮
            </button>
          </div>
        </div>
      </div>
      <div id="loading">
        <div className="card">
          <h2>电动木质滚珠机</h2>
          <p>正在装配齿轮、链条与轨道…</p>
        </div>
      </div>
      <div id="error" role="alert">
        <div className="card">
          <h2>三维场景加载失败</h2>
          <p id="error-text">无法加载三维组件库。请刷新页面重试。</p>
        </div>
      </div>
    </main>
  );
}
