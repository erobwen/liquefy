import "./materialAndIcons.css";
import { getButtonProperties } from "@liquefy/ui-themed"
import 'mdui/mdui.css';
import 'mdui';

const button = (...parameters) => {
  const properties = getButtonProperties(parameters);
  const key = properties.key;
  return getRenderContext().create({type: "elementNode", tagName: "mdui-button", key: key ? key + ".text-" + stamp++ : null, ...properties})
}
