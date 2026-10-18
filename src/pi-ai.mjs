// The @mariozechner/pi-ai surface vendored Open CoDesign code calls, answered by BYOKit: scripts/build.mjs resolves
// every import of that package here, so no vendored code reaches a provider by itself. Open CoDesign is written
// against pi-ai 0.72 and BYOKit pins @earendil-works/pi-ai 1.2.0; the two meet only here: the 0.72 model gives the
// route (its provider, byokit:<route>) and the model id, and BYOKit's 1.2.0 answer goes back as the same plain
// assistant message (content, usage, stopReason). Anything else vendored code imports from pi-ai fails the build.
import { respond, routeOf } from './byokit.mjs';

// No model registry: Open CoDesign then builds its model from the wire it is given.
export const getModel = () => undefined;

export async function completeSimple(model, context, options) {
  const route = routeOf(model.provider);
  if (!route) throw new Error(`model provider ${model.provider} is not a byokit:<route> agent`);
  return respond({ route, model: model.id, context, maxTokens: options.maxTokens, signal: options.signal });
}
