import React from 'react';
import {createRoot} from 'react-dom/client';
import {App} from './App';
import './styles.css';
class CompatibilityBoundary extends React.Component<React.PropsWithChildren,{error:Error|null}> {
 state:{error:Error|null}={error:null};
 static getDerivedStateFromError(error:Error){return {error};}
 render(){return this.state.error?<main className="main-content" role="alert"><h1>无法初始化学习工具</h1><p>{this.state.error.message}</p><p>请换用支持安全随机数的浏览器，或刷新后重试。未覆盖浏览器中的原学习记录。</p></main>:this.props.children;}
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><CompatibilityBoundary><App/></CompatibilityBoundary></React.StrictMode>);
