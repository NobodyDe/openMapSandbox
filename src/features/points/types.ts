export interface MapPoint {
  id: string;
  name: string;
  lng: number;
  lat: number;
  color: string; // cor do pin (padrão: cor do tipo de obra no KMZ)
  attributes: Record<string, string>; // dados da obra, já sem campos vazios, para o popup
}
