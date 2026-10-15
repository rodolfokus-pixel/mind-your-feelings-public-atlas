import { Workbook } from "@oai/artifact-tool";
const wb=Workbook.create();
console.log(await wb.help("chart"));
