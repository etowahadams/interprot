import {
  PluginStateObject as PSO,
  PluginStateTransform,
} from "molstar/lib/mol-plugin-state/objects";
import { PluginContext } from "molstar/lib/mol-plugin/context";

function _getAllEntities(plugin: PluginContext, tag: string | undefined, list: EntityCells) {
  list.push(...getEntities(plugin, tag));
  for (const g of getGroups(plugin, tag)) {
    _getAllEntities(plugin, g.params?.values.tag, list);
  }
  return list;
}

export function getEntities(plugin: PluginContext, tag?: string): EntityCells {
  const s = plugin.customState as MesoscaleExplorerState;
  const k = `entities-${tag || ""}`;
  if (!s.stateCache[k]) {
    const structureSelector =
      tag !== undefined
        ? StateSelection.Generators.ofTransformer(StructureRepresentation3D).withTag(tag)
        : StateSelection.Generators.ofTransformer(StructureRepresentation3D);
    const shapeSelector =
      tag !== undefined
        ? StateSelection.Generators.ofTransformer(ShapeRepresentation3D).withTag(tag)
        : StateSelection.Generators.ofTransformer(ShapeRepresentation3D);
    s.stateCache[k] = [
      ...plugin.state.data
        .select(structureSelector)
        .filter((c) => c.obj!.data.sourceData.elementCount > 0),
      ...plugin.state.data.select(shapeSelector),
    ];
  }
  return s.stateCache[k];
}

export function getAllEntities(plugin: PluginContext, tag?: string) {
  return _getAllEntities(plugin, tag, []);
}

export async function updateStyle(
  plugin: PluginContext,
  options: { ignoreLight: boolean; material: Material; celShaded: boolean; illustrative: boolean }
) {
  const update = plugin.state.data.build();
  const { ignoreLight, material, celShaded, illustrative } = options;

  const entities = getAllEntities(plugin);

  for (let j = 0; j < entities.length; ++j) {
    update.to(entities[j]).update((old) => {
      if (old.type) {
        const value =
          old.colorTheme.name === "illustrative"
            ? old.colorTheme.params.style.params.value
            : old.colorTheme.params.value;
        const lightness =
          old.colorTheme.name === "illustrative"
            ? old.colorTheme.params.style.params.lightness
            : old.colorTheme.params.lightness;
        if (illustrative) {
          old.colorTheme = {
            name: "illustrative",
            params: { style: { name: "uniform", params: { value, lightness } } },
          };
        } else {
          old.colorTheme = { name: "uniform", params: { value, lightness } };
        }
        old.type.params.ignoreLight = ignoreLight;
        old.type.params.material = material;
        old.type.params.celShaded = celShaded;
      }
    });
  }

  await update.commit();
}
