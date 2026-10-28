import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { RotateCcw, Move, Circle, Cog, ArrowDown } from "lucide-react";

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
      <header className="title">
        <div className="wordmark"><span className="brand-dot" /> MARBLE ATELIER <span className="edition">/ 01</span></div>
        <h1>电动木质滚珠机<span>让机械，温柔地运转。</span></h1>
        <p>齿轮的节拍，滚珠的旅程。一座可以亲手探索的微型工坊。</p>
      </header>
      <div className="live-badge"><span className="live-dot" /><span id="status" role="status">正在装配机构…</span></div>
      <div id="view" aria-label="交互式三维滚珠机：拖动旋转，滚轮缩放" />
      <aside className="journey" aria-label="循环路线">
        <span className="journey-label">指挥球的旅程</span>
        <span className="journey-key"><i />黄铜球带领每一幕</span>
        <span data-stage="lift"><Cog size={14} />链条提升</span><ArrowDown size={12} />
        <span data-stage="spiral"><Circle size={14} />螺旋环槽</span><ArrowDown size={12} />
        <span data-stage="return"><ArrowDown size={14} />波浪回流</span>
      </aside>
      <div className="journey-mobile" aria-label="指挥球当前阶段"><i /><span>指挥球</span><strong id="journey-current">链条提升</strong></div>
      <aside id="performance-card" className="performance-card" aria-label="机械谢幕" data-phase="cruising">
        <div className="performance-copy"><span className="performance-eyebrow">A LITTLE CURTAIN CALL</span><strong id="performance-title">黄铜指挥球 · 第 1 幕</strong><p id="performance-caption" role="status">黄铜球完成 0 / 2 圈后谢幕</p></div>
        <div id="arrival-details" className="arrival-details" hidden>
          <div id="arrival-progress" className="arrival-progress" role="progressbar" aria-label="滚珠归队进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={0}><i /></div>
          <div id="arrival-dots" className="arrival-dots" role="list" aria-label="每颗滚珠的归队状态" />
          <span id="arrival-summary" className="arrival-summary" />
          <p id="director-caption" className="director-caption" role="status" hidden />
        </div>
        <button id="btn-performance" type="button" aria-pressed="false">演出一段</button>
        <button id="btn-watch" type="button" aria-pressed="false" aria-label="开启或退出演出镜头"><span className="watch-full">观看演出</span><span className="watch-short">观看</span></button>
        <button className="curtain-closeup" type="button" data-view="curtain" aria-pressed="false" aria-label="近看回收闸门与谢幕钟">近看</button>
      </aside>
      <div className="gesture-hint"><Move size={14} /><span>拖动旋转 · 滚轮或双指缩放</span></div>
      <div id="hud">
        <div className="experience" role="group" aria-label="八音盒与跟球体验">
          <button id="btn-music" type="button" aria-pressed="false" title="聆听滚珠旋律与机械轻响">开启声音</button>
          <button id="btn-compose" type="button" aria-controls="piano-editor" aria-expanded="false" aria-pressed="false">编写旋律</button>
          <button id="btn-routing" type="button" aria-controls="routing-editor" aria-expanded="false">道岔·交替</button>
          <button id="btn-follow" type="button" aria-pressed="false">跟随滚珠</button>
          <button id="btn-drive" type="button" aria-controls="drive-panel" aria-expanded="false">动力观察</button>
        </div>
        <div className="bar" role="toolbar" aria-label="仿真控制">
          <div className="group play-group"><span className="control-label">运行</span><button id="btn-play" type="button" aria-pressed="true">暂停</button></div>
          <div className="group" role="group" aria-label="速度"><span className="control-label">节奏</span><div className="segments">
            {[0.5, 1, 2].map(value => <button type="button" key={value} data-speed={value} aria-pressed={value === 1}>{value}×</button>)}
          </div></div>
          <div className="group" role="group" aria-label="钢珠数量"><span className="control-label">滚珠</span><div className="segments">
            {[4, 8, 12].map(value => <button type="button" key={value} data-count={value} aria-pressed={value === 8}>{value} 颗</button>)}
          </div></div>
          <div className="group" role="group" aria-label="视角"><span className="control-label">观察</span><div className="segments">
            {[["wide", "全景"], ["top", "俯视"], ["gears", "齿轮"]].map(([value, label]) => <button type="button" key={value} data-view={value} aria-pressed={value === "wide"}>{label}</button>)}
          </div></div>
          <div className="group reset-group"><span className="control-label">重新开始</span><button id="btn-reset" type="button" aria-label="重新开始"><RotateCcw size={17} /></button></div>
        </div>
        <p className="exhibit-note">滚珠拨动小锤 · 六块琴片，一段自己的旋律</p>
      </div>
      <section id="piano-editor" className="piano-editor" aria-label="机械琴桥编曲" hidden>
        <div className="piano-heading"><div><span className="piano-eyebrow">MECHANICAL MUSIC / 06</span><h2>写一段滚珠旋律</h2></div><button id="btn-compose-close" type="button" aria-label="收起编曲面板">×</button></div>
        <p>点击琴片切换音高，选到「—」留出空拍。也可以直接点击场景里的琴片。</p>
        <div className="piano-score" role="group" aria-label="六块琴片的音符">
          {["Do", "Mi", "Sol", "La", "Sol", "Mi"].map((note, index) => <button key={index} type="button" data-piano-note={index} aria-label={`琴片 ${index+1}：${note}，点击切换音符`}><span>{String(index+1).padStart(2,"0")}</span><strong>{note}</strong><i /></button>)}
        </div>
        <div className="piano-actions"><button type="button" data-view="piano" aria-pressed="false">近看琴桥</button><button id="btn-score-reset" type="button">恢复旋律</button></div>
        <p id="piano-feedback" className="piano-feedback" role="status" aria-live="polite">旋律自动保存在此浏览器 · 开启声音后聆听</p>
      </section>
      <section id="routing-editor" className="piano-editor routing-editor" aria-label="双路轮唱道岔" hidden>
        <div className="piano-heading"><div><span className="piano-eyebrow">MECHANICAL DUET / 02</span><h2>让两条轨道对唱</h2></div><button id="btn-routing-close" type="button" aria-label="收起道岔面板">×</button></div>
        <p>主路奏六块琴片，绕行路用低音回应。也可以直接点击木质手柄拨动道岔。</p>
        <div className="route-modes" role="group" aria-label="下一颗滚珠的路线">
          {[["main","主旋律"],["response","低音回应"],["alternate","两路交替"]].map(([mode,label])=><button key={mode} type="button" data-route={mode} aria-pressed={mode==="alternate"}>{label}</button>)}
        </div>
        <div className="route-voices"><span><i />主路 · 你的六音旋律</span><span><i />回应 · 低音 Do / Mi / Sol</span></div>
        <div className="piano-actions"><button type="button" data-view="duet" aria-pressed="false">近看双路</button><span id="route-stats">主路 0 颗 · 回应 0 颗</span></div>
        <p id="routing-feedback" className="piano-feedback" role="status">岔口有球时，等它通过再换向；汇流口轮流放行。</p>
      </section>
      <section id="drive-panel" className="drive-panel" aria-label="动力传动观察" hidden>
        <div className="piano-heading"><div><span className="piano-eyebrow">INSIDE THE WORKSHOP / 04</span><h2>看见动力的旅程</h2></div><button id="btn-drive-close" type="button" aria-label="退出动力观察">×</button></div>
        <div className="drive-steps" role="group" aria-label="观察机构">
          {['电机','减速','主轴','提升'].map((label,i)=><button key={label} type="button" data-drive-step={i} aria-pressed={i===0}><span>0{i+1}</span>{label}</button>)}
        </div>
        <h3 id="drive-title">电机 · 动力从这里出发</h3>
        <p id="drive-description">铜色转子带动输入轴，黄铜联轴器把转动送给第一枚小齿轮。</p>
        <div id="drive-metric" className="drive-metric">输入端 / 12 齿</div>
        <div className="drive-actions">
          <button id="btn-drive-tour" type="button" aria-pressed="false">沿动力参观</button>
          <button id="btn-drive-pause" type="button" aria-pressed="false">暂停</button>
          <button id="btn-drive-slow" type="button" aria-pressed="true">慢放 ×¼</button>
          <button id="btn-drive-reveal" type="button" aria-pressed="false">透视外壳</button>
        </div>
        <p className="drive-hint" id="drive-hint">拖动可自由观察 · 慢放为当前节奏的 ¼</p>
      </section>
      <div id="loading"><div className="card"><div className="assembly-mark" /><p className="wordmark">MARBLE ATELIER</p><h2>小工坊，即将开动</h2><p>正在装配齿轮、链条与轨道…</p></div></div>
      <div id="error" role="alert"><div className="card"><h2>三维场景加载失败</h2><p id="error-text">无法加载三维组件库。请刷新页面重试。</p><button type="button" onClick={() => window.location.reload()}>重新加载</button></div></div>
    </main>
  );
}
