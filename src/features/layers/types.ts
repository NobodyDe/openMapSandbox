// O mínimo que a lista precisa; MapPoint e Trecho já têm esses campos
export interface LayerItem {
  id: string;
  color: string;
  attributes: Record<string, string>;
}
