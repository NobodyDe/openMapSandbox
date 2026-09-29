import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { Layer, useMap } from "react-map-gl/maplibre";
import type { FragmentsModel } from "@thatopen/fragments";
import { Matrix4 } from "three";
import { getFragmentsEngine } from "./fragmentsEngine";
import { readIfcSiteLocation } from "./ifcSite";
import { hideIfcTerrain } from "./hideIfcTerrain";
import { buildModelMatrices, resolveAnchor, type ModelMatrices } from "./georef";
import { createFragmentsLayer } from "./createFragmentsLayer";
import {
  MODEL_CAMERA,
  type Anchor,
  type Model3dConfig,
  type ModelStatus,
} from "./models";

interface Model3dLayerProps {
  config: Model3dConfig;
  anchor: Anchor | undefined; // vem do MapView: é o que o painel de calibração edita
  onAnchorResolved: (id: string, anchor: Anchor) => void;
  onStatusChange: (id: string, status: ModelStatus) => void;
}

interface LoadedModel {
  layerId: string;
  model: FragmentsModel;
}

// export default: é o formato que o React.lazy espera
export default function Model3dLayer({
  config,
  anchor,
  onAnchorResolved,
  onStatusChange,
}: Model3dLayerProps) {
  const { current: mapRef } = useMap();
  const [loaded, setLoaded] = useState<LoadedModel | null>(null);
  // Mutáveis e compartilhadas com a camada: mudar a âncora altera ESTAS matrizes,
  // e o próximo frame já desenha o modelo no lugar novo, sem recarregar nada
  const [modelMatrices] = useState<ModelMatrices>(() => ({
    mercator: new Matrix4(),
    globe: new Matrix4(),
  }));

  // 1) Carregar: depende só do modelo, nunca da âncora
  useEffect(() => {
    const engine = getFragmentsEngine();
    const modelId = `${config.id}-${crypto.randomUUID()}`; // único por montagem: o StrictMode monta 2× em dev
    const download = new AbortController();
    let cancelled = false;
    let isLoaded = false;
    onStatusChange(config.id, "loading");

    (async () => {
      const buffer = await fetch(config.url, { signal: download.signal }).then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.arrayBuffer();
      });
      const model = await engine.load(buffer, { modelId });
      isLoaded = true;
      // Desmontou enquanto carregava: o cleanup não tinha o que descartar, então descarta aqui
      if (cancelled) {
        await engine.disposeModel(modelId);
        return;
      }
      const site = await readIfcSiteLocation(model);
      await hideIfcTerrain(model); // antes de a camada existir: a base nunca chega a aparecer
      if (cancelled) return; // o cleanup já descartou (isLoaded = true)
      onAnchorResolved(config.id, resolveAnchor(config, site));
      setLoaded({ layerId: `model3d-${modelId}`, model });
      onStatusChange(config.id, "ready");
    })().catch((error: unknown) => {
      if (cancelled) return; // inclui o AbortError do download cancelado: não é falha
      console.error(error);
      onStatusChange(config.id, "error");
    });

    return () => {
      cancelled = true;
      download.abort();
      if (isLoaded) void engine.disposeModel(modelId);
      setLoaded(null); // a camada aponta para o modelo que acabou de ser descartado
    };
  }, [config, onAnchorResolved, onStatusChange]);

  // 2) Posicionar: cada ajuste do painel só recalcula a matriz
  useEffect(() => {
    if (!anchor) return;
    const next = buildModelMatrices(anchor);
    modelMatrices.mercator.copy(next.mercator);
    modelMatrices.globe.copy(next.globe);
  }, [anchor, modelMatrices]);

  const layer = useMemo(
    () => loaded && createFragmentsLayer(loaded.layerId, loaded.model, modelMatrices),
    [loaded, modelMatrices],
  );

  // 3) Voar até o modelo quando ele aparece. O useEffectEvent lê a âncora ATUAL sem
  // torná-la dependência; senão cada ajuste de calibração faria o mapa voar de novo
  const flyToModel = useEffectEvent(() => {
    if (anchor) mapRef?.flyTo({ center: [anchor.lng, anchor.lat], ...MODEL_CAMERA });
  });
  useEffect(() => {
    if (layer) flyToModel();
  }, [layer]);

  if (!layer || !anchor) return null;
  // key = id único por carga: o <Layer> do react-map-gl não readiciona uma camada com o mesmo id
  return <Layer key={layer.id} {...layer} />;
}
