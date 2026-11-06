import InsurerLogo from './InsurerLogo';

export default function RecommendationIdentity({ fund, showTrack = false }) {
  return <div className="sb-recommendation-identity">
    <div><p className="muted">{fund.name}</p>{showTrack && <p>{fund.investmentTrack}</p>}</div>
    <InsurerLogo provider={fund.provider} fallback="חברה מנהלת" />
  </div>;
}
