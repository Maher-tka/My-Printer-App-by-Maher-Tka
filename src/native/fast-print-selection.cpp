#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <shobjidl.h>
#include <shellapi.h>
#include <oleidl.h>
#include <atomic>
#include <string>
#include <vector>
#include <new>

// Explorer delivers the entire selection in one IDataObject. This bridge only
// writes a selection manifest and starts the app; it never executes file contents.
static const CLSID CLSID_Selection={0x629b66de,0x9172,0x48df,{0xa7,0xdd,0x34,0x82,0x25,0xb0,0x69,0x3f}};
static std::atomic<long> objects{0}, locks{0};
static HRESULT filesFromData(IDataObject* data,std::vector<std::wstring>& files) {
  if(!data) return E_INVALIDARG;
  IShellItemArray* items=nullptr;
  HRESULT hr=SHCreateShellItemArrayFromDataObject(data,IID_PPV_ARGS(&items));
  if(SUCCEEDED(hr)) {
    DWORD count=0;hr=items->GetCount(&count);
    if(SUCCEEDED(hr) && (count==0 || count>1000)) hr=E_INVALIDARG;
    for(DWORD i=0;SUCCEEDED(hr) && i<count;++i) {
      IShellItem* item=nullptr;hr=items->GetItemAt(i,&item);
      if(FAILED(hr)) break;
      PWSTR path=nullptr;hr=item->GetDisplayName(SIGDN_FILESYSPATH,&path);item->Release();
      if(SUCCEEDED(hr)) { files.emplace_back(path);CoTaskMemFree(path); }
    }
    items->Release();return hr;
  }
  // Standard clipboard file drops need not expose IShellItemArray.
  FORMATETC format={CF_HDROP,nullptr,DVASPECT_CONTENT,-1,TYMED_HGLOBAL};STGMEDIUM medium{};
  hr=data->GetData(&format,&medium);if(FAILED(hr))return hr;
  HDROP drop=reinterpret_cast<HDROP>(medium.hGlobal);
  UINT count=DragQueryFileW(drop,0xFFFFFFFF,nullptr,0);
  if(count==0 || count>1000)hr=E_INVALIDARG;
  for(UINT i=0;SUCCEEDED(hr) && i<count;++i) {
    UINT length=DragQueryFileW(drop,i,nullptr,0);std::vector<wchar_t> path(length+1);
    if(!DragQueryFileW(drop,i,path.data(),length+1)){hr=E_FAIL;break;}
    files.emplace_back(path.data());
  }
  ReleaseStgMedium(&medium);return hr;
}
static std::wstring jsonString(const std::wstring& text) {
  std::wstring result=L"\"";
  for(wchar_t c:text) {
    if(c==L'\\'||c==L'"'){result+=L'\\';result+=c;}
    else if(c<32){wchar_t escaped[7];swprintf_s(escaped,L"\\u%04x",static_cast<unsigned>(c));result+=escaped;}
    else result+=c;
  }
  return result+L"\"";
}
static HRESULT writeManifest(IDataObject* data,std::wstring& output) {
  std::vector<std::wstring> files;HRESULT hr=filesFromData(data,files);if(FAILED(hr))return hr;
  std::wstring json=L"{\"version\":1,\"files\":[";
  for(size_t i=0;i<files.size();++i){if(i)json+=L",";json+=jsonString(files[i]);}json+=L"]}";
  int length=WideCharToMultiByte(CP_UTF8,WC_ERR_INVALID_CHARS,json.data(),static_cast<int>(json.size()),nullptr,0,nullptr,nullptr);
  if(length<=0 || length>4*1024*1024)return E_INVALIDARG;
  std::vector<char> bytes(length);WideCharToMultiByte(CP_UTF8,WC_ERR_INVALID_CHARS,json.data(),static_cast<int>(json.size()),bytes.data(),length,nullptr,nullptr);
  wchar_t temp[32768];DWORD size=GetTempPathW(32768,temp);if(!size||size>=32768)return E_FAIL;
  std::wstring directory=std::wstring(temp)+L"maher-fast-print-selection";
  if(!CreateDirectoryW(directory.c_str(),nullptr)&&GetLastError()!=ERROR_ALREADY_EXISTS)return HRESULT_FROM_WIN32(GetLastError());
  GUID id;hr=CoCreateGuid(&id);if(FAILED(hr))return hr;wchar_t name[40];StringFromGUID2(id,name,40);
  output=directory+L"\\"+name+L".json";
  HANDLE file=CreateFileW(output.c_str(),GENERIC_WRITE,0,nullptr,CREATE_NEW,FILE_ATTRIBUTE_TEMPORARY,nullptr);
  if(file==INVALID_HANDLE_VALUE)return HRESULT_FROM_WIN32(GetLastError());
  DWORD written=0;BOOL success=WriteFile(file,bytes.data(),length,&written,nullptr);DWORD error=GetLastError();CloseHandle(file);
  if(!success||written!=static_cast<DWORD>(length)){DeleteFileW(output.c_str());return HRESULT_FROM_WIN32(success?ERROR_WRITE_FAULT:error);}
  return S_OK;
}
extern "C" HRESULT __stdcall FastPrintWriteSelectionManifest(IDataObject* data,PWSTR* path) {
  if(!path)return E_POINTER;*path=nullptr;
  try {std::wstring output;HRESULT hr=writeManifest(data,output);if(FAILED(hr))return hr;
    *path=static_cast<PWSTR>(CoTaskMemAlloc((output.size()+1)*sizeof(wchar_t)));
    if(!*path){DeleteFileW(output.c_str());return E_OUTOFMEMORY;}
    memcpy(*path,output.c_str(),(output.size()+1)*sizeof(wchar_t));return S_OK;
  }catch(...){return E_OUTOFMEMORY;}
}
static HRESULT launch(IDataObject* data) {
  wchar_t prefix[32768];DWORD size=sizeof(prefix);
  LONG status=RegGetValueW(HKEY_LOCAL_MACHINE,L"Software\\Classes\\*\\shell\\MaherTka.FastPrint",L"BatchCommand",RRF_RT_REG_SZ,nullptr,prefix,&size);
  if(status!=ERROR_SUCCESS)return HRESULT_FROM_WIN32(status);
  std::wstring manifest;HRESULT hr=writeManifest(data,manifest);if(FAILED(hr))return hr;
  std::wstring command=std::wstring(prefix)+L" \""+manifest+L"\"";
  std::vector<wchar_t> buffer(command.begin(),command.end());buffer.push_back(0);
  STARTUPINFOW startup{sizeof(startup)};PROCESS_INFORMATION process{};
  BOOL success=CreateProcessW(nullptr,buffer.data(),nullptr,nullptr,FALSE,CREATE_UNICODE_ENVIRONMENT,nullptr,nullptr,&startup,&process);
  if(!success){DWORD error=GetLastError();DeleteFileW(manifest.c_str());return HRESULT_FROM_WIN32(error);}
  CloseHandle(process.hThread);CloseHandle(process.hProcess);return S_OK;
}
class Selection final:public IDropTarget {
  std::atomic<ULONG> references{1};
public:
  Selection(){++objects;}~Selection(){--objects;}
  HRESULT STDMETHODCALLTYPE QueryInterface(REFIID iid,void** out)override {if(!out)return E_POINTER;*out=nullptr;if(iid==IID_IUnknown||iid==IID_IDropTarget){*out=static_cast<IDropTarget*>(this);AddRef();return S_OK;}return E_NOINTERFACE;}
  ULONG STDMETHODCALLTYPE AddRef()override{return ++references;}
  ULONG STDMETHODCALLTYPE Release()override{ULONG n=--references;if(!n)delete this;return n;}
  HRESULT STDMETHODCALLTYPE DragEnter(IDataObject*,DWORD,POINTL,DWORD* effect)override{if(effect)*effect=DROPEFFECT_COPY;return S_OK;}
  HRESULT STDMETHODCALLTYPE DragOver(DWORD,POINTL,DWORD* effect)override{if(effect)*effect=DROPEFFECT_COPY;return S_OK;}
  HRESULT STDMETHODCALLTYPE DragLeave()override{return S_OK;}
  HRESULT STDMETHODCALLTYPE Drop(IDataObject* data,DWORD,POINTL,DWORD* effect)override {
    HRESULT hr;
    try{hr=launch(data);}catch(...){hr=E_OUTOFMEMORY;}
    if(effect)*effect=SUCCEEDED(hr)?DROPEFFECT_COPY:DROPEFFECT_NONE;
    if(FAILED(hr))MessageBoxW(nullptr,L"Fast Print could not receive the selected documents. Select up to 1,000 files, or repair the Fast Print installation.",L"Fast Print",MB_OK|MB_ICONERROR);
    return hr;
  }
};
class Factory final:public IClassFactory {
  std::atomic<ULONG> references{1};
public:
  Factory(){++objects;}~Factory(){--objects;}
  HRESULT STDMETHODCALLTYPE QueryInterface(REFIID iid,void** out)override{if(!out)return E_POINTER;*out=nullptr;if(iid==IID_IUnknown||iid==IID_IClassFactory){*out=static_cast<IClassFactory*>(this);AddRef();return S_OK;}return E_NOINTERFACE;}
  ULONG STDMETHODCALLTYPE AddRef()override{return ++references;}
  ULONG STDMETHODCALLTYPE Release()override{ULONG n=--references;if(!n)delete this;return n;}
  HRESULT STDMETHODCALLTYPE CreateInstance(IUnknown* outer,REFIID iid,void** out)override{if(outer)return CLASS_E_NOAGGREGATION;auto value=new(std::nothrow) Selection();if(!value)return E_OUTOFMEMORY;HRESULT hr=value->QueryInterface(iid,out);value->Release();return hr;}
  HRESULT STDMETHODCALLTYPE LockServer(BOOL lock)override{if(lock)++locks;else --locks;return S_OK;}
};
STDAPI DllGetClassObject(REFCLSID clsid,REFIID iid,void** out){if(clsid!=CLSID_Selection)return CLASS_E_CLASSNOTAVAILABLE;auto factory=new(std::nothrow) Factory();if(!factory)return E_OUTOFMEMORY;HRESULT hr=factory->QueryInterface(iid,out);factory->Release();return hr;}
STDAPI DllCanUnloadNow(){return objects==0&&locks==0?S_OK:S_FALSE;}
