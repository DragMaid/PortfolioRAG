# AnalyticsApi

All URIs are relative to *http://localhost:5009*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**analyticsRecordView**](AnalyticsApi.md#analyticsrecordview) | **POST** /api/analytics/views |  |



## analyticsRecordView

> analyticsRecordView(trackViewDto)



### Example

```ts
import {
  Configuration,
  AnalyticsApi,
} from '';
import type { AnalyticsRecordViewRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new AnalyticsApi();

  const body = {
    // TrackViewDto
    trackViewDto: ...,
  } satisfies AnalyticsRecordViewRequest;

  try {
    const data = await api.analyticsRecordView(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **trackViewDto** | [TrackViewDto](TrackViewDto.md) |  | |

### Return type

`void` (Empty response body)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **202** |  |  -  |
| **400** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

