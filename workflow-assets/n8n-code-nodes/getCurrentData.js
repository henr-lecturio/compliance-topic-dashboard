const staticData = $getWorkflowStaticData('global');
const collectedItems = staticData.items || [];

return collectedItems.map(item => ({ json: item }));