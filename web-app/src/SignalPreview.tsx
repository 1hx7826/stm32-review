import {useState} from 'react';

export function SignalPreview(){
 const [low,setLow]=useState(false);
 return <section className="signal-preview" aria-label="GPIO电平交互示意">
  <div className="demo-heading"><span>试着改变一次电平</span><a href="#/library/kp.course2.s3">来自 2.3 闪灯课</a></div>
  <div className={'demo-circuit '+(low?'is-lit':'')} role="img" aria-label={low?'PC13输出低电平，课程电路的LED点亮':'PC13输出高电平，课程电路的LED熄灭'}>
   <div className="circuit-node"><small>电源</small><strong>3.3 V</strong></div>
   <div className="circuit-resistor"><small>限流</small><svg viewBox="0 0 62 24" aria-hidden="true"><path d="M0 12H8l5-8 8 16 8-16 8 16 8-16 5 8h12" fill="none" stroke="currentColor" strokeWidth="2"/></svg></div>
   <div className="circuit-led"><small>LED</small><span className="led-bulb"/></div>
   <div className="circuit-pin"><small>PC13</small><strong>{low?'0 V':'3.3 V'}</strong></div>
  </div>
  <div className="demo-code"><pre><code><span>GPIO_WriteBit</span>(GPIOC, GPIO_Pin_13,<br/>    <b>{low?'Bit_RESET':'Bit_SET'}</b>);</code></pre></div>
  <div className="demo-operation"><p role="status"><i className={low?'lit':''}/>{low?'低电平，LED 亮':'高电平，LED 灭'}</p><button aria-pressed={low} onClick={()=>setLow(v=>!v)}>{low?'改为高电平':'输出低电平'}<svg width="15" height="15" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4 10h12m-5-5 5 5-5 5"/></svg></button></div>
  <p className="demo-caption">本课接法是低电平点亮。这里只改变示意，不连接硬件。</p>
 </section>;
}
