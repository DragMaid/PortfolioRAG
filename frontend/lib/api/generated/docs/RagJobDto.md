
# RagJobDto


## Properties

Name | Type
------------ | -------------
`id` | string
`kind` | [RagJobKind](RagJobKind.md)
`status` | [RagJobStatus](RagJobStatus.md)
`createdAt` | Date
`completedAt` | Date
`error` | string
`estimatedSeconds` | number
`report` | [JobFitReportDto](JobFitReportDto.md)
`coverLetter` | [CoverLetterDto](CoverLetterDto.md)
`retrieval` | [RetrievalResultDto](RetrievalResultDto.md)

## Example

```typescript
import type { RagJobDto } from ''

// TODO: Update the object below with actual values
const example = {
  "id": null,
  "kind": null,
  "status": null,
  "createdAt": null,
  "completedAt": null,
  "error": null,
  "estimatedSeconds": null,
  "report": null,
  "coverLetter": null,
  "retrieval": null,
} satisfies RagJobDto

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as RagJobDto
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


