export type PromptSchema = {prompt_id?:string;mode:'strict'|'hybrid'|'open';labels:string[];definitions:Record<string,string>};
export const reservedOutcomes=['NEGATIVE','UNRESOLVED'];
export function effectivePromptSchema(schema:PromptSchema):PromptSchema {
  return schema.mode==='open' ? {...schema,labels:[...reservedOutcomes],definitions:{NEGATIVE:'The evidence explicitly rejects or indicates no relationship between the records.',UNRESOLVED:'Insufficient evidence to determine a relationship between the records.'}} : schema;
}
export function presetSchema(promptId:string,preset:PromptSchema,mode=preset.mode):PromptSchema {
 return effectivePromptSchema({prompt_id:promptId,mode,labels:[...preset.labels],definitions:{...preset.definitions}});
}
