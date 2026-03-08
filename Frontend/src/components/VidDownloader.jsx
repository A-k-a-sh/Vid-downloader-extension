import { useState, useEffect } from "react";
import axios from "axios";
import { XIcon, FileIcon, Download, SunIcon, MoonIcon, Eye, LoaderCircle } from 'lucide-react';
import "./VidDownloader.css";
// import { getNetwork } from "./network";


function VidDownloader() {
  // const [serverUrl, setServerUrl] = useState("http://localhost:8080");
  const serverUrl = "http://localhost:8080";

  // useEffect(() => {
  //   getNetwork(setServerUrl);
  // }, []);


  const [pastedVideoUrl, setPastedVideoUrl] = useState("");



  const [loading, setLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(null)

  const [singleVideoFormatData, setSingleVideoFormatData] = useState(null)
  const [playlistFormatData, setPlaylistFormatData] = useState(null)

  // Extended localStorage functions for complex data
  const setStorageItem = (key, value) => {
    try {
      localStorage.setItem(`viddownloader_${key}`, JSON.stringify(value));
      console.log('Saved to localStorage:', key, value);
    } catch (error) {
      console.log('Error saving to localStorage:', error);
    }
  };

  const getStorageItem = (key) => {
    try {
      const item = localStorage.getItem(`viddownloader_${key}`);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.log('Error loading from localStorage:', error);
      return null;
    }
  };

  // Load persisted state when component mounts
  useEffect(() => {
    console.log('Loading persisted state from localStorage...');

    const savedUrl = getStorageItem('pastedVideoUrl');
    const savedSingleData = getStorageItem('singleVideoFormatData');
    const savedPlaylistData = getStorageItem('playlistFormatData');
    const savedTheme = getStorageItem('theme');

    if (savedUrl) {
      console.log('Restoring URL:', savedUrl);
      setPastedVideoUrl(savedUrl);
    }
    if (savedSingleData) {
      console.log('Restoring single video data');
      setSingleVideoFormatData(savedSingleData);
    }
    if (savedPlaylistData) {
      console.log('Restoring playlist data');
      setPlaylistFormatData(savedPlaylistData);
    }
    if (savedTheme) {
      console.log('Restoring theme:', savedTheme);
      setTheme(savedTheme);
    }
  }, []);

  // Update functions that also save to storage
  const updatePastedVideoUrl = (url) => {
    setPastedVideoUrl(url);
    setStorageItem('pastedVideoUrl', url);
  };

  const updateSingleVideoFormatData = (data) => {
    setSingleVideoFormatData(data);
    setStorageItem('singleVideoFormatData', data);
  };

  const updatePlaylistFormatData = (data) => {
    setPlaylistFormatData(data);
    setStorageItem('playlistFormatData', data);
  };

  const checkValidUrl = (url) => {
    try {
      new URL(url);
      return true;
    } catch (error) {
      return false;
    }
  }

  // Get current tab's URL only if no URL is stored
  useEffect(() => {
    const savedUrl = getStorageItem('pastedVideoUrl');
    if (!savedUrl) {
      chrome.runtime.sendMessage({ action: "getTabUrl" }, (response) => {
        if (response?.url) {
          if (checkValidUrl(response.url)) {
            updatePastedVideoUrl(response.url);
          }
        }
      });
    }
  }, []);

  const getInitialTheme = () => {
    const saved = getStorageItem('theme');
    if (saved === "light" || saved === "dark") return saved;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    return prefersDark ? "dark" : "light";
  };

  const [theme, setTheme] = useState(getInitialTheme);

  // Apply theme to body and save to storage
  useEffect(() => {
    if (theme === "dark") {
      document.body.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
    }
    setStorageItem('theme', theme);
  }, [theme]);

  const getFormats = async (links, fromPlaylistView = false) => {
    console.log('clicked');
    if (links === '' || !checkValidUrl(links)) {
      return;
    }
    try {
      console.log('getting formats');
      if (!fromPlaylistView) {
        updateSingleVideoFormatData(null);
        updatePlaylistFormatData(null);
      }
      else {
        updatePastedVideoUrl(links);
        updateSingleVideoFormatData(null);
      }
      setLoading(true)
      const url = `${serverUrl}/formats?url=${links}`;
      const res = await axios.get(url);
      console.log(res.data);
      if (res.data?.isPlaylist) {
        updatePlaylistFormatData(res.data);
      }
      else {
        updateSingleVideoFormatData(res.data);
      }
      setLoading(false)
    } catch (error) {
      console.log(error);
      setLoading(false);
    }
  }

  const getPlaylistFormats = async (playlistUrl) => {
    try {
      setLoading(true)
      updateSingleVideoFormatData(null);

      console.log('getting playlist formats');
      const url = `${serverUrl}/formats/playlist?url=${playlistUrl}`;
      const res = await axios.get(url);
      console.log(res.data);
      updateSingleVideoFormatData(res.data);
      setLoading(false)
    } catch (error) {
      console.log(error);
      setLoading(false);
    }
  }

  const download = async (links, format_id) => {
    console.log('downloading');
    const url = `${serverUrl}/download?url=${encodeURIComponent(links)}&format=${format_id}`;
    try {
      setIsDownloading(format_id)
      
      // Backend saves directly to Downloads folder
      const res = await axios.get(url);
      
      if (res.data.success) {
        console.log('Download complete:', res.data.filename);
        alert(`✅ Downloaded: ${res.data.filename}\n\nCheck your Downloads folder!`);
      }
      
      setIsDownloading(null)
    } catch (error) {
      console.log(error);
      alert('❌ Download failed. Check console for details.');
      setIsDownloading(null);
    }
  }

  const downloadPlaylist = async (playlistUrl, format_id) => {
    console.log('downloading playlist');
    const url = `${serverUrl}/download/playlist?url=${encodeURIComponent(playlistUrl)}&format=${format_id}`;
    try {
      setIsDownloading(format_id)
      
      // Backend saves directly to Downloads folder
      const res = await axios.get(url);
      
      if (res.data.success) {
        console.log('Download complete:', res.data.filename);
        alert(`✅ Downloaded: ${res.data.filename}\n\nCheck your Downloads folder!`);
      }
      
      setIsDownloading(null)
    } catch (error) {
      console.log(error);
      alert('❌ Download failed. Check console for details.');
      setIsDownloading(null);
    }
  }

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  // Get current tab URL and fill the search box
  const getCurrentTabUrl = () => {
    chrome.runtime.sendMessage({ action: "getTabUrl" }, (response) => {
      if (response?.url) {
        if (checkValidUrl(response.url)) {
          updatePastedVideoUrl(response.url);
          console.log('Filled with current tab URL:', response.url);
        } else {
          console.log('Current tab URL is not valid');
        }
      }
    });
  };

  // Clear all stored data function
  const clearStoredData = () => {
    try {
      localStorage.removeItem('viddownloader_pastedVideoUrl');
      localStorage.removeItem('viddownloader_singleVideoFormatData');
      localStorage.removeItem('viddownloader_playlistFormatData');
      localStorage.removeItem('viddownloader_theme');
      setPastedVideoUrl("");
      setSingleVideoFormatData(null);
      setPlaylistFormatData(null);
      console.log('Cleared all stored data');
    } catch (error) {
      console.log('Error clearing storage:', error);
    }
  };

  return (
    <div className={`${theme === "dark" ? "bg-zinc-950/90" : "mainDiv"} w-[400px] h-[600px] overflow-y-scroll box-border relative `}>

      {theme === "dark" ? (
        <SunIcon
          className="fixed  sunAnimation top-4 text-white fill-white right-4 cursor-pointer z-10"
          onClick={() => toggleTheme()}
        />
      ) : (
        <MoonIcon
          className="fixed top-4 moonAnimation text-white right-4 fill-white cursor-pointer z-10"
          onClick={toggleTheme}
        />
      )}

      <header className="mt-20">
        <h1 className="text-4xl font-bold text-center text-emerald-400">Online Video Downloader</h1>
      </header>

      <div className="text-white mt-20 mb-14 flex flex-col md:w-[70%] w-[95%] mx-auto justify-center items-center flex-wrap ">

        {/* Button to get current page URL - above search box */}
        <div className="w-full mb-3">
          <button
            onClick={getCurrentTabUrl}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded transition-colors duration-150 flex items-center justify-center gap-2"
            title="Fill search box with current page URL"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v11a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H4zm0 2h12v11H4V4zm3 3a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
            Use Current Page URL
          </button>
        </div>

        {/* input and button */}
        <div className="flex justify-center items-center w-full  flex-row gap-3 h-12 overflow-visible flex-wrap">
          <div className="flex-1 h-full relative min-w-[300px] ">
            <input
              type="text"
              value={pastedVideoUrl}
              onChange={(e) => updatePastedVideoUrl(e.target.value)}
              placeholder="Enter video URL"
              className="bg-zinc-700/60  tracking-widest w-full text-white  rounded-lg outline-none h-full  px-2 pr-8 py-1 border-lime-50 focus:border-[0.2px] shadow-2xl shadow-neutral-900 font-light space-x-16 space-y-72"
            />

            {
              pastedVideoUrl && (
                <XIcon className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white hover:text-red-400 cursor-pointer duration-150" onClick={() => updatePastedVideoUrl("")} />
              )
            }

          </div>

          <button onClick={() => getFormats(pastedVideoUrl)} className="bg-teal-300 hover:bg-teal-400 text-white h-full  text-wrap font-bold py-2 px-4 z-40 cursor-pointer rounded uppercase  tracking-widest">
            Download
          </button>

          {/* Debug buttons - remove this later */}
          <button
            onClick={clearStoredData}
            className="bg-red-500 hover:bg-red-600 text-white h-full px-3 rounded text-xs whitespace-nowrap"
            title="Clear stored data"
          >
            Clear Data
          </button>
          <button
            onClick={() => console.log('Current state:', { singleVideoFormatData, playlistFormatData, pastedVideoUrl })}
            className="bg-blue-500 hover:bg-blue-600 text-white h-full px-3 rounded text-xs whitespace-nowrap"
            title="Log current state to console"
          >
            Log State
          </button>
        </div>

        {
          singleVideoFormatData || playlistFormatData ? (
            <div className="w-full mt-10 ">

              <div className="mt-12  md:mt-0 mb-4  w-full flex items-center flex-row gap-2 text-2xl">
                <FileIcon className="w-10 h-10" />
                <p className=" font-thin text-lime-50">{playlistFormatData?.title || singleVideoFormatData?.title}</p>
              </div>

              {playlistFormatData && (
                <div className="w-full mt-10 ">

                  <p className="text-2xl font-bold">Playlist</p>

                  <div className="mb-7 w-full flex justify-center  flex-col md:flex-row gap-2  ">

                    {
                      playlistFormatData?.thumbnail &&
                      <img
                        src={playlistFormatData?.thumbnail}
                        alt=""
                        className=" md:w-1/2  w-full max-h-[250px] object-cover object-center rounded-md "
                      />
                    }

                    <div className="flex-1 overflow-scroll px-4 py-2 bg-gray-800/60 items-center h-[250px] justify-center w-full max-h-[250px]">

                      <p>Uploader : {playlistFormatData.uploader} </p>
                      <p>Duration : {playlistFormatData.duration}</p>
                      <p className="pt-2">Description : {playlistFormatData.description}</p>
                    </div>
                  </div>

                  <div className="mt-2 mb-4 w-full flex flex-col max-h-[450px] overflow-scroll px-2  ">

                    {
                      playlistFormatData.formats.map((singleVideo, index) => (
                        <div key={index} className="flex  items-center md:justify-around  w-full py-3 rounded-lg my-3 flex-wrap px-2 gap-3 md:gap-0 ">

                          <div className="flex   items-center w-[60%] flex-nowrap md:gap-4 gap-2 flex-row">
                            <img
                              src={singleVideo.thumbnail}
                              alt=""
                              className="w-20 h-14 object-cover object-center rounded-md"
                            />
                            <p>Title : {singleVideo.title}</p>
                          </div>
                          <button
                            className="w-full  py-2 px-4 md:w-auto border rounded-md bg-lime-800/10 flex items-center justify-center gap-2"
                            onClick={() => getFormats(singleVideo.url, true)}
                          >

                            <Eye />
                            <p>View</p>

                          </button>
                        </div>
                      ))
                    }

                  </div>

                  <div className="w-full flex justify-center mb-4">
                    <button
                      className="bg-teal-300 hover:bg-teal-400 text-white h-full  text-wrap font-bold py-2 px-4 z-40 cursor-pointer rounded uppercase  tracking-widest"
                      onClick={() => getPlaylistFormats(playlistFormatData.url)}>
                      Download All
                    </button>
                  </div>

                </div>
              )}

              {
                singleVideoFormatData ? (
                  <div className="w-full ">

                    {
                      !singleVideoFormatData.isPlaylist && (
                        <div className="mb-7 w-full flex justify-center  flex-col md:flex-row gap-2  ">

                          {
                            singleVideoFormatData?.thumbnail &&
                            <img
                              src={singleVideoFormatData?.thumbnail}
                              alt=""
                              className=" md:w-1/2  w-full max-h-[250px] object-cover object-center rounded-md "
                            />
                          }

                          <div className="flex-1 overflow-scroll px-4 py-2 bg-gray-800/60 items-center h-[250px] justify-center w-full max-h-[250px]">

                            <p>Title : {singleVideoFormatData.title} </p>
                            <p>Uploader : {singleVideoFormatData.uploader} </p>
                            <p>Duration : {singleVideoFormatData.duration}</p>
                            <p className="pt-2">Description : {singleVideoFormatData.description}</p>
                          </div>
                        </div>
                      )
                    }

                    <div className="mt-10 w-full py-4 border flex flex-wrap justify-around mb-4 font-bold bg-green-50/35 rounded-md">
                      <p className="px-3">Format</p>
                      <p className="px-3">Video Quality</p>
                      <p className="px-3">File size</p>
                      <p className="px-3">Download links</p>
                    </div>

                    <div className="mt-2 w-full flex flex-col max-h-[450px] overflow-scroll px-2 ">

                      {
                        singleVideoFormatData.formats.map((format, index) => (

                          <div key={index} className="flex  items-center justify-around  w-full py-3 bg-slate-300/20 rounded-lg my-3 flex-wrap px-2 gap-3 md:gap-0 ">

                            <div className="flex justify-between w-[60%] flex-wrap flex-row">
                              <p> {format.ext} </p>
                              <p> {format.resolution} </p>
                              <p> {format.size} </p>
                            </div>
                            <button
                              className="w-full  py-2 px-4 md:w-auto border rounded-md bg-lime-800/10 flex items-center justify-center gap-2"
                              onClick={() =>
                                !singleVideoFormatData.isPlaylist
                                  ? download(pastedVideoUrl, format.format_id)
                                  : downloadPlaylist(pastedVideoUrl, Number(format.format_id))
                              }

                            >
                              {isDownloading === format.format_id ? (
                                <LoaderCircle className="animate-spin" />
                              ) : (
                                <Download />
                              )}

                              <p>Download  </p>

                            </button>
                          </div>
                        ))
                      }

                    </div>

                  </div>
                ) : (
                  loading ?
                    <div className="w-full mt-20 h-[200px]  flex items-center justify-center">
                      <LoaderCircle className="animate-spin w-16 h-16" />
                    </div>
                    : null
                )
              }

            </div>
          ) : (
            loading ?
              <div className="w-full mt-20 h-[200px]  flex items-center justify-center">
                <LoaderCircle className="animate-spin w-16 h-16" />
              </div>
              : null

          )
        }

      </div>

    </div>
  );
}

export default VidDownloader;