import { loadYamlTree, toKnowledgeBase } from '../../tools/build-data.js';
export const kb = toKnowledgeBase(loadYamlTree());
