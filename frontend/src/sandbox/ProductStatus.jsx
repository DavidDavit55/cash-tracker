export default function ProductStatus({ product }) {
  const status = product.status?.trim();
  const temporary = status === 'ריסק זמני' || (!status && product.warningText === 'ריסק זמני');
  const active = status === 'פעיל';
  const inactive = status === 'לא פעיל' || status === 'לא פעילה' || (!status && product.warningText === 'לא פעיל');
  const kind = temporary ? 'risk' : active ? 'active' : inactive ? 'inactive' : 'unknown';
  const text = temporary ? 'ריסק זמני' : active ? 'פעיל' : inactive ? 'לא פעיל' : status || 'סטטוס לא התקבל';
  return <span className={`sb-product-status sb-status-${kind}`}>{text}</span>;
}
