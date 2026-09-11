
# AnalyticsSummaryDto


## Properties

Name | Type
------------ | -------------
`windowDays` | number
`from` | Date
`to` | Date
`uniqueVisitors` | [MetricDto](MetricDto.md)
`reads` | [MetricDto](MetricDto.md)
`avgDwellSeconds` | [MetricDto](MetricDto.md)
`daily` | [Array&lt;DailyTrafficDto&gt;](DailyTrafficDto.md)
`referrers` | [Array&lt;ReferrerDto&gt;](ReferrerDto.md)
`topPosts` | [Array&lt;TopPostDto&gt;](TopPostDto.md)

## Example

```typescript
import type { AnalyticsSummaryDto } from ''

// TODO: Update the object below with actual values
const example = {
  "windowDays": null,
  "from": null,
  "to": null,
  "uniqueVisitors": null,
  "reads": null,
  "avgDwellSeconds": null,
  "daily": null,
  "referrers": null,
  "topPosts": null,
} satisfies AnalyticsSummaryDto

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as AnalyticsSummaryDto
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


