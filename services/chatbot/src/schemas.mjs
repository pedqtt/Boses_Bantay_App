const text=(maxLength=600)=>({type:'string',maxLength});
const list=(items,maxItems)=>({type:'array',items,maxItems});
const object=properties=>({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
export const evidence=object({source_id:{type:'integer',minimum:1,maximum:6},quote:{type:'string',minLength:1,maxLength:700}});
export const draftSchema=object({
  status:{type:'string',enum:['answered','partial','ambiguous','conflict','no_information','low_confidence','out_of_scope','abuse_only']},
  claims:list(object({text:{type:'string',minLength:1,maxLength:600},kind:{type:'string',enum:['documented']},evidence:{...list(evidence,4),minItems:1}}),6),
  missing_aspects:list(text(250),5),clarification:text(350),
  conflicts:list(object({topic:text(200),evidence:{...list(evidence,2),minItems:2}}),3),
  suggestions:list(object({question:{type:'string',minLength:1,maxLength:160},evidence:{...list(evidence,2),minItems:1}}),3)
});
export const reviewSchema=object({
  claims:list(object({id:{type:'integer',minimum:0,maximum:5},supported:{type:'boolean'}}),6),
  conflicts:list(object({id:{type:'integer',minimum:0,maximum:2},supported:{type:'boolean'}}),3),
  suggestions:list(object({id:{type:'integer',minimum:0,maximum:2},supported:{type:'boolean'}}),3),
  missing_aspects:list(text(250),5),ambiguous:{type:'boolean'},clarification:text(350),scope_allowed:{type:'boolean'},safe_response:{type:'boolean'},topic_present:{type:'boolean'}
});

export function reviewSchemaFor(draft) {
  const schema=structuredClone(reviewSchema);
  for(const field of ['claims','conflicts','suggestions']) {
    const size=(draft[field]||[]).length;
    schema.properties[field].minItems=size;
    schema.properties[field].maxItems=size;
    if(size)schema.properties[field].items.properties.id.enum=Array.from({length:size},(_,id)=>id);
  }
  return schema;
}

function valid(value,schema) {
  if(schema.type==='object')return value!==null && typeof value==='object' && !Array.isArray(value) &&
    Object.keys(value).every(k=>Object.hasOwn(schema.properties,k)) && schema.required.every(k=>Object.hasOwn(value,k)&&valid(value[k],schema.properties[k]));
  if(schema.type==='array')return Array.isArray(value)&&value.length<=(schema.maxItems??Infinity)&&value.length>=(schema.minItems??0)&&value.every(v=>valid(v,schema.items));
  if(schema.type==='string')return typeof value==='string'&&value.length<=(schema.maxLength??Infinity)&&value.length>=(schema.minLength??0)&&(!schema.enum||schema.enum.includes(value));
  if(schema.type==='integer')return Number.isSafeInteger(value)&&value>=(schema.minimum??-Infinity)&&value<=(schema.maximum??Infinity)&&(!schema.enum||schema.enum.includes(value));
  return schema.type==='boolean'&&typeof value==='boolean';
}
export function parseStructured(value,schema) {
  const parsed=typeof value==='string'?JSON.parse(value):value;
  if(!valid(parsed,schema))throw new Error('invalid_model_contract');return parsed;
}
