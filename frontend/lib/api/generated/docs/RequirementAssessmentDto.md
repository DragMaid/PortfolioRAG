
# RequirementAssessmentDto


## Properties

Name | Type
------------ | -------------
`requirement` | string
`isEssential` | boolean
`status` | [RequirementStatus](RequirementStatus.md)
`confidence` | number
`rationale` | string
`evidence` | [Array&lt;EvidenceDto&gt;](EvidenceDto.md)

## Example

```typescript
import type { RequirementAssessmentDto } from ''

// TODO: Update the object below with actual values
const example = {
  "requirement": null,
  "isEssential": null,
  "status": null,
  "confidence": null,
  "rationale": null,
  "evidence": null,
} satisfies RequirementAssessmentDto

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as RequirementAssessmentDto
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


