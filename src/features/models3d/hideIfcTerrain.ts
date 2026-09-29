import type { FragmentsModel } from "@thatopen/fragments";

// O terreno (sólido topográfico) exportado pelo Revit disputa espaço com o chão do mapa;
// no mapa, o chão é o do mapa
export async function hideIfcTerrain(model: FragmentsModel): Promise<void> {
  const { IFCGEOGRAPHICELEMENT: ids = [] } = await model.getItemsOfCategories([
    /^IFCGEOGRAPHICELEMENT$/,
  ]);
  if (ids.length > 0) await model.setVisible(ids, false);
}
