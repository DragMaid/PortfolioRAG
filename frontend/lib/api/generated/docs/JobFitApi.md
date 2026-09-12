# JobFitApi

All URIs are relative to *http://localhost:5019*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**jobFitGetAvailability**](JobFitApi.md#jobfitgetavailability) | **GET** /api/authors/handle/{handle}/job-fit |  |
| [**jobFitGetJob**](JobFitApi.md#jobfitgetjob) | **GET** /api/job-fit/{id} |  |
| [**jobFitSubmit**](JobFitApi.md#jobfitsubmit) | **POST** /api/authors/handle/{handle}/job-fit |  |



## jobFitGetAvailability

> JobFitAvailabilityDto jobFitGetAvailability(handle)



### Example

```ts
import {
  Configuration,
  JobFitApi,
} from '';
import type { JobFitGetAvailabilityRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JobFitApi();

  const body = {
    // string
    handle: handle_example,
  } satisfies JobFitGetAvailabilityRequest;

  try {
    const data = await api.jobFitGetAvailability(body);
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
| **handle** | `string` |  | [Defaults to `undefined`] |

### Return type

[**JobFitAvailabilityDto**](JobFitAvailabilityDto.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## jobFitGetJob

> RagJobDto jobFitGetJob(id)



### Example

```ts
import {
  Configuration,
  JobFitApi,
} from '';
import type { JobFitGetJobRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JobFitApi();

  const body = {
    // string
    id: id_example,
  } satisfies JobFitGetJobRequest;

  try {
    const data = await api.jobFitGetJob(body);
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
| **id** | `string` |  | [Defaults to `undefined`] |

### Return type

[**RagJobDto**](RagJobDto.md)

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** |  |  -  |
| **404** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


## jobFitSubmit

> RagJobDto jobFitSubmit(handle, jobFitRequestDto)



### Example

```ts
import {
  Configuration,
  JobFitApi,
} from '';
import type { JobFitSubmitRequest } from '';

async function example() {
  console.log("🚀 Testing  SDK...");
  const api = new JobFitApi();

  const body = {
    // string
    handle: handle_example,
    // JobFitRequestDto
    jobFitRequestDto: ...,
  } satisfies JobFitSubmitRequest;

  try {
    const data = await api.jobFitSubmit(body);
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
| **handle** | `string` |  | [Defaults to `undefined`] |
| **jobFitRequestDto** | [JobFitRequestDto](JobFitRequestDto.md) |  | |

### Return type

[**RagJobDto**](RagJobDto.md)

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
| **404** |  |  -  |
| **409** |  |  -  |
| **413** |  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

