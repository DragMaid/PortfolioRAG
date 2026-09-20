
# JobFitReportDto


## Properties

Name | Type
------------ | -------------
`roleTitle` | string
`company` | string
`verdict` | [JobFitVerdict](JobFitVerdict.md)
`score` | number
`headline` | string
`summary` | string
`requirements` | [Array&lt;RequirementAssessmentDto&gt;](RequirementAssessmentDto.md)
`strengths` | Array&lt;string&gt;
`gaps` | Array&lt;string&gt;
`retrieval` | [RetrievalTraceDto](RetrievalTraceDto.md)
`usage` | [UsageDto](UsageDto.md)

## Example

```typescript
import type { JobFitReportDto } from ''

// TODO: Update the object below with actual values
const example = {
  "roleTitle": null,
  "company": null,
  "verdict": null,
  "score": null,
  "headline": null,
  "summary": null,
  "requirements": null,
  "strengths": null,
  "gaps": null,
  "retrieval": null,
  "usage": null,
} satisfies JobFitReportDto

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as JobFitReportDto
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


