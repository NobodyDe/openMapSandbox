import { useEffect, useEffectEvent, useMemo, useState } from "react";
import { Layer, useMap } from "react-map-gl/maplibre";
import { Matrix4 } from "three";
import { buildModelMatrices, resolveAnchor, type ModelMatrices } from "./georef";
import { createThreeLayer } from "./createThreeLayer";
import { LOADERS } from "./loaders";
import type { LoadedModel } from "./loaders/types";
import {
  MODEL_CAMERA,
  type Anchor,
  type LoadableModel,
  type ModelStatus,
} from "./models";

interface Model3dLayerProps {
  config: LoadableModel;
  anchor: Anchor | undefined; // vem do MapView: é o que o painel de calibração edita
  onAnchorResolved: (id: string, anchor: Anchor) => void;
  onStatusChange: (id: string, status: ModelStatus) => void;
}

interface LoadedLayer {
  layerId: string;
  model: LoadedModel;
}

// export default: é o formato que o React.lazy espera
export default function Model3dLayer({
  config,
  anchor,
  onAnchorResolved,
  onStatusChange,
}: Model3dLayerProps) {
  const { current: mapRef } = useMap();
  const [loaded, setLoaded] = useState<LoadedLayer | null>(null);
  // Mutáveis e compartilhadas com a camada: mudar a âncora altera ESTAS matrizes,
  // e o próximo frame já desenha o modelo no lugar novo, sem recarregar nada
  const [modelMatrices] = useState<ModelMatrices>(() => ({
    mercator: new Matrix4(),
    globe: new Matrix4(),
  }));

  // 1) Carregar: depende só do modelo, nunca da âncora. Um carregador por formato
  useEffect(() => {
    const controller = new AbortController();
    let model: LoadedModel | null = null;
    onStatusChange(config.id, "loading");

    LOADERS[config.format ?? "frag"](config, controller.signal)
      .then((result) => {
        // Desmontou enquanto carregava: o cleanup não tinha o que descartar, então descarta aqui
        if (controller.signal.aborted) return void result.dispose();
        model = result;
        const center = mapRef!.getCenter(); // dentro do <MapGL> o mapa sempre existe
        onAnchorResolved(config.id, resolveAnchor(config, result.site ?? null, { lng: center.lng, lat: center.lat }));
        setLoaded({ layerId: `model3d-${config.id}-${crypto.randomUUID()}`, model: result });
        onStatusChange(config.id, "ready");
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return; // inclui o AbortError do download cancelado: não é falha
        console.error(error);
        onStatusChange(config.id, "error");
      });

    return () => {
      controller.abort();
      if (model) void model.dispose();
      setLoaded(null); // a camada aponta para o modelo que acabou de ser descartado
    };
  }, [config, mapRef, onAnchorResolved, onStatusChange]);

  // 2) Posicionar: cada ajuste do painel só recalcula a matriz
  useEffect(() => {
    if (!anchor) return;
    const next = buildModelMatrices(anchor);
    modelMatrices.mercator.copy(next.mercator);
    modelMatrices.globe.copy(next.globe);
  }, [anchor, modelMatrices]);

  const layer = useMemo(
    () => loaded && createThreeLayer(loaded.layerId, loaded.model, modelMatrices),
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
