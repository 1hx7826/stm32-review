type Props={kind:string;caption:string};
const paths:Record<string,{labels:string[];note:string}>={
 toolchain:{labels:['源码 / 意图','编译 / 组织','传输 / 执行','观察 / 验证'],note:'每一层都有自己的输入、输出和失败原因。'},
 mcu:{labels:['程序 Flash','Cortex-M3','总线 / 外设','GPIO / 电路'],note:'CPU 配置硬件，外设按照时钟与寄存器工作。'},
 pin:{labels:['封装方向','管脚编号','PAx / PBx','实际电路'],note:'端口名、封装脚号、排针号需要一一对应。'},
 'serial-block':{labels:['软件写 DR','发送寄存器','移位寄存器','TX 引脚'],note:'TXE：可填下个字节；TC：最后一帧已结束。接收走相反方向。'},
 'bus-stack':{labels:['业务意图','驱动接口','协议步骤','引脚电平'],note:'每一层约定参数、成功条件和失败处理。'},
 flash:{labels:['写使能','擦除 / 等忙','编程 / 等忙','读回比较'],note:'仅在可擦区域实验；页边界、寿命和掉电均需考虑。'},
 irq:{labels:['外设事件','外设使能','NVIC / 优先级','短 ISR'],note:'沿链路逐层检查；耗时业务交给主循环。'},
 exti:{labels:['PA5 / PA6','AFIO → 线5/6','EXTI 边沿','EXTI9_5 IRQ'],note:'共享入口内分别检查与清除挂起；机械按钮还要消抖。'},
 clock:{labels:['8MHz HSE','PLL ×9','HCLK 72MHz','APB1 ÷2'],note:'常见示例：PCLK1=36MHz、TIM3=72MHz；ADC仍需专用分频。'},
 timer:{labels:['fTIM','PSC + 1','CNT 计数','ARR + 1'],note:'向上计数更新周期=(PSC+1)×(ARR+1)/fTIM。'},
 trigger:{labels:['输入 / ITR','TRGI 选择','从模式控制','复位 / 门控'],note:'TRGO 可沿片上互连成为其他模块的触发源。'},
 adc:{labels:['模拟通道','采样保持','规则 / 注入','DR / JDR'],note:'通道号、序列位置与结果位置分别核对。'},
 'adc-trigger':{labels:['TIM1 更新','TRGO','注入触发','JEOC → JDR'],note:'按课程使用注入组，不混用规则EOC/DR。'},
 'adc-scan':{labels:['PA0 / 通道0','Rank1 / JDR1','PA1 / 通道1','Rank2 / JDR2'],note:'两路依次采样，不是同一时刻。结果位置由序列配置决定。'},
 sar:{labels:['输入电压','采样保持','逐位比较','12位数字码'],note:'4096种码；分辨率不等于实际精度。'},
 sampling:{labels:['源阻抗','采样电容','采样周期','+12.5周期'],note:'总时间=(采样周期+12.5)/fADC；时钟和建立时间都要满足。'},
 oled:{labels:['文字 / 图形','像素 / 位图','页列与命令','I²C 传输'],note:'ACK只证明传输阶段接收，不证明像素绘制正确。'}
};
export function Diagram({kind,caption}:Props){
 if(['uart','i2c-frame','spi','pwm','capture','encoder','echo','edge'].includes(kind)){
 const encoder=kind==='encoder',i2c=kind==='i2c-frame',uart=kind==='uart',edge=kind==='edge';
 const a=uart?'TX':encoder?'A':i2c?'SCL':kind==='echo'?'TRIG':kind==='capture'?'输入':kind==='pwm'?'周期基准':edge?'边沿':'SCK';
 const b=uart?'位':encoder?'B':i2c?'SDA':kind==='echo'?'Echo':kind==='capture'?'捕获':kind==='pwm'?'PWM':edge?'比较示意':'DATA';
 return <figure className="diagram"><svg viewBox="0 0 640 210" role="img" aria-label={encoder?'正交编码器A/B相位示意':i2c?'I2C起始与数据时钟示意':uart?'UART起始与数据位示意':'时序关系示意'}>
 <text x="15" y="55">{a}</text><text x="15" y="129">{b}</text>
 {[100,160,220,280,340,400,460,520,580].map(x=><path key={x} className="grid-line" d={`M${x} 25V165`}/>)}
 <path className="signal" d={uart?'M90 38H150V70H210V38H270V70H330V38H390V70H450V38H570':edge?'M90 75H160C195 75 190 38 225 38H290V75H360C400 75 390 38 430 38H570':kind==='echo'?'M90 70H140V38H170V70H570':'M90 70H130V38H190V70H250V38H310V70H370V38H430V70H490V38H550V70H580'}/>
 <path className="signal secondary" d={encoder?'M90 145H160V113H220V145H280V113H340V145H400V113H460V145H520V113H580':uart?'M90 130H580':i2c?'M90 113H112V145H180V113H245V145H310V113H375V145H440V113H520V145H580':kind==='echo'?'M90 145H225V113H480V145H580':'M90 145H160V113H310V145H400V113H550V145H580'}/>
 <text className="annotation" x="95" y="190">{encoder?'相位先后 → 方向；有效边沿 → 计数':uart?'空闲 → 起始位 → 数据位（示意，未画完整帧）':i2c?'SCL高时SDA下降为START；数据在低电平阶段改变':'示意不按比例；以本节配置、时基与边沿定义为准'}</text></svg><figcaption>{caption}</figcaption></figure>;
 }
 if(kind==='led')return <figure className="diagram"><svg viewBox="0 0 640 215" role="img" aria-label="3.3V经限流电阻和LED流向低电平PC13的串联通路">
 <text x="25" y="52">3.3 V</text><text x="145" y="52">限流电阻</text><text x="310" y="52">LED</text><text x="463" y="52">PC13</text>
 <path className="wire" d="M45 85H130l8-12 12 24 12-24 12 24 12-24 12 12h82M360 85H455"/>
 <rect x="280" y="65" width="80" height="40" rx="5"/><text x="300" y="92">LED</text>
 <rect x="455" y="65" width="135" height="40" rx="5"/><text x="470" y="92">输出低电平</text>
 <path className="wire" d="M70 135H530l-12-7m12 7-12 7"/><text x="82" y="166">电流：电源 → 电阻 → LED → PC13 下拉</text>
 <text className="annotation" x="55" y="196">PC13 拉高时两端压差不足，LED 熄灭。按实际板级接线判断极性。</text>
 </svg><figcaption>{caption}</figcaption></figure>;
 if(['gpio','led','button','i2c-bus'].includes(kind)){
 const bus=kind==='i2c-bus',led=kind==='led',button=kind==='button';
 return <figure className="diagram"><svg viewBox="0 0 640 220" role="img" aria-label={bus?'I2C共享开漏与上拉示意':led?'PC13低有效LED电流路径示意':button?'上拉按钮输入示意':'GPIO输出驱动示意'}>
 <text x="80" y="27">3.3 V（按器件核对）</text><path className="wire" d="M170 38V60l-10 6 20 9-20 9 20 9-10 6v30"/>
 <text x="210" y="85">{bus||button?'上拉电阻':led?'限流电阻 + LED':'输出驱动'}</text>
 <path className="wire" d="M95 129H475"/><circle cx="170" cy="129" r="4"/>
 <rect x="70" y="145" width="190" height="50" rx="8"/><text x="88" y="176">{led?'PC13 拉低 → 亮':button?'输入读 IDR':bus?'主机：拉低 / 释放':'GPIO：控制驱动'}</text>
 <path className="wire" d="M170 129V145M475 129V145"/>
 <rect x="375" y="145" width="200" height="50" rx="8"/><text x="390" y="176">{bus?'从机：拉低 / 释放':button?'按钮闭合 → GND':led?'完整通路才有电流':'负载与外部电路'}</text>
 </svg><figcaption>{caption} {bus?'图中只画一根共享线的等效关系，SCL/SDA分别检查。':''}</figcaption></figure>;
 }
 const d=paths[kind]||paths['bus-stack'];
 return <figure className="diagram"><div className="diagram-flow">{d.labels.map((t,i)=><div key={t}><small>0{i+1}</small><strong>{t}</strong>{i<3&&<span aria-hidden="true">→</span>}</div>)}</div><p>{d.note}</p><figcaption>{caption}</figcaption></figure>;
}
