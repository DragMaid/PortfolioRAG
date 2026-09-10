# AdminAnalyticsApi

All URIs are relative to *http://localhost:5009*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**adminAnalyticsExportCsv**](AdminAnalyticsApi.md#adminanalyticsexportcsv) | **GET** /api/admin/analytics/export |  |
| [**adminAnalyticsGetSummary**](AdminAnalyticsApi.md#adminanalyticsgetsummary) | **GET** /api/admin/analytics/summary |  |



## adminAnalyticsExportCsv

> adminAnalyticsExportCsv(days)



### Example

```ts
import {
  Configuration,
  AdminAnalyticsApi,
} from '';
import type { AdminAnalyticsExportCsvRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminAnalyticsApi(config);

  const body = {
    // number (optional)
    days: 56,
  } satisfies AdminAnalyticsExportCsvRequest;

  try {
    const data = await api.adminAnalyticsExportCsv(body);
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
| **days** | `number` |  | [Optional] [Defaults to `7`] |

### Return type

`void` (Empty response body)

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** |  |  -  |
| **401** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## adminAnalyticsGetSummary

> AnalyticsSummaryDto adminAnalyticsGetSummary(days)



### Example

```ts
import {
  Configuration,
  AdminAnalyticsApi,
} from '';
import type { AdminAnalyticsGetSummaryRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const config = new Configuration({ 
    // Configure HTTP bearer authorization: Bearer
    accessToken: "YOUR BEARER TOKEN",
  });
  const api = new AdminAnalyticsApi(config);

  const body = {
    // number (optional)
    days: 56,
  } satisfies AdminAnalyticsGetSummaryRequest;

  try {
    const data = await api.adminAnalyticsGetSummary(body);
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
| **days** | `number` |  | [Optional] [Defaults to `7`] |

### Return type

[**AnalyticsSummaryDto**](AnalyticsSummaryDto.md)

### Authorization

[Bearer](../README.md#Bearer)

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** |  |  -  |
| **401** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

