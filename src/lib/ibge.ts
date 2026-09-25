const IBGE_MALHAS_URL = "https://servicodados.ibge.gov.br/api/v3/malhas";

export function municipalityBordersUrl(uf: string): string {
  return `${IBGE_MALHAS_URL}/estados/${uf}?intrarregiao=municipio&formato=application/vnd.geo+json&qualidade=intermediaria`;
}
