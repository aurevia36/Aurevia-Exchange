import InfoPage from '@/components/InfoPage';
import InvestmentEducationAssistant from '@/components/InvestmentEducationAssistant';

export default function Education(){
  return <InfoPage eyebrow="Learning center" title="Build market understanding" lead="Use these starting points to explore common investing concepts alongside Aurevia Exchange's DEMO practice workspace and, when available, Alpaca Paper Trading experience." updated="October 27, 2026" sections={[
    {title:'Start with the basics',content:<p>Learn how asset prices, order types, and portfolio allocations are commonly described. The application is a learning aid, not a substitute for independent research or professional advice.</p>},
    {title:'Understand risk',content:<p>Market prices can move unpredictably, and losses can exceed expectations. Consider time horizon, diversification, and your own financial circumstances before making real investment decisions.</p>},
    {title:'Practice with DEMO',content:<p>Explore the dashboard, wallet, and trading screens using DEMO mode. REAL-mode orders, when enabled, use Alpaca Paper Trading only. Neither DEMO nor paper trading uses your Aurevia wallet balance as real brokerage cash or predicts how a live market will behave.</p>},
    {title:'AI learning assistant',content:<InvestmentEducationAssistant/>},
  ]}/>;
}