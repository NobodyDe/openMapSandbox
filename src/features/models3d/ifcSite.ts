import type { FragmentsModel, ItemAttribute } from "@thatopen/fragments";
import { compoundAngleToDegrees } from "./georef";

// ItemData[nome] é ItemAttribute ({ value, type }) ou ItemData[] (relações); aqui só atributos
function attributeValue(item: Record<string, unknown> | undefined, name: string): unknown {
  return (item?.[name] as ItemAttribute | undefined)?.value;
}

export async function readIfcSiteLocation(model: FragmentsModel) {
  const { IFCSITE: [siteId] = [] } = await model.getItemsOfCategories([/IFCSITE/]);
  if (siteId === undefined) return null;
  const [site] = await model.getItemsData([siteId]);
  const lat = attributeValue(site, "RefLatitude");
  const lng = attributeValue(site, "RefLongitude");
  return Array.isArray(lat) && Array.isArray(lng)
    ? { lat: compoundAngleToDegrees(lat), lng: compoundAngleToDegrees(lng) }
    : null;
}
