const staticData = $getWorkflowStaticData('global');
delete staticData.items;

return [{ json: { cleaned: true } }];