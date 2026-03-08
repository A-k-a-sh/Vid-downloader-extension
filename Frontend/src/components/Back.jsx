import { useState, useEffect } from "react";
import axios from "axios";
import { XIcon, FileIcon, Download, SunIcon, MoonIcon, Eye, LoaderCircle } from 'lucide-react';
import "./VidDownloader.css";

function VidDownloader() {
  const [pastedVideoUrl, setPastedVideoUrl] = useState("");
  const serverUrl = "http://192.168.0.102:8080";

  const [loading, setLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(null)

  const [singleVideoFormatData, setSingleVideoFormatData] = useState(null)
  const [playlistFormatData, setPlaylistFormatData] = useState(null)

  const checkValidUrl = (url) => {
    try {
      new URL(url);
      return true;
    } catch (error) {
      return false;
    }
  }

  // Get current tab's URL
  useEffect(() => {
    chrome.runtime.sendMessage({ action: "getTabUrl" }, (response) => {
      if (response?.url) {
        if(checkValidUrl(response.url)){
            setPastedVideoUrl(response.url);
        }
        // getFormats(response.url); // Auto-fetch formats for the current tab
      }
    });
  }, []);

  const getInitialTheme = () => {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") return saved;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    return prefersDark ? "dark" : "light";
  };

  const [theme, setTheme] = useState(getInitialTheme);
  // Apply theme to body or html
  useEffect(() => {
    if (theme === "dark") {
      document.body.classList.add("dark");
    } else {
      document.body.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  

  const getFormats = async (links, fromPlaylistView = false) => {
    console.log('clicked');
    if (links === '' || !checkValidUrl(links)) {
      return;
    }
    try {
      console.log('getting formats');
      if (!fromPlaylistView) {
        setSingleVideoFormatData(null)
        setPlaylistFormatData(null)
      }
      else {
        setPastedVideoUrl(links)
        setSingleVideoFormatData(null)
      }
      setLoading(true)
      const url = `${serverUrl}/formats?url=${links}`;
      const res = await axios.get(url);
      console.log(res.data);
      if (res.data?.isPlaylist) {
        setPlaylistFormatData(res.data)
      }
      else {
        setSingleVideoFormatData(res.data)
      }
      setLoading(false)
    } catch (error) {
      console.log(error);
    }
  }

  const getPlaylistFormats = async (playlistUrl) => {
    try {
      setLoading(true)
      setSingleVideoFormatData(null)

      console.log('getting playlist formats');
      const url = `${serverUrl}/formats/playlist?url=${playlistUrl}`;
      const res = await axios.get(url);
      console.log(res.data);
      setSingleVideoFormatData(res.data)
      setLoading(false)
    } catch (error) {
      console.log(error);
    }
  }

  const download = async (links, format_id) => {
    console.log('downloading');
    const url = `${serverUrl}/download?url=${links}&format=${format_id}`;
    try {
      setIsDownloading(format_id)
      const res = await axios.get(url);
      console.log(res.data);
      setIsDownloading(null)
    } catch (error) {
      console.log(error);
    }
  }


  const downloadPlaylist = async (playlistUrl, format_id) => {
    console.log('downloading playlist');
    const url = `${serverUrl}/download/playlist?url=${playlistUrl}&format=${format_id}`;
    try {
      setIsDownloading(format_id)
      const res = await axios.get(url);
      console.log(res.data);
      setIsDownloading(null)
    } catch (error) {
      console.log(error);
    }
  }

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
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

        {/* input and button */}
        <div className="flex justify-center items-center w-full  flex-row gap-8 h-12 overflow-visible flex-wrap">
          <div className="flex-1 h-full relative min-w-[300px] ">
            <input
              type="text"
              value={pastedVideoUrl}
              onChange={(e) => setPastedVideoUrl(e.target.value)}
              placeholder="Enter video URL"
              className="bg-zinc-700/60  tracking-widest w-full text-white  rounded-lg outline-none h-full  px-2 pr-8 py-1 border-lime-50 focus:border-[0.2px] shadow-2xl shadow-neutral-900 font-light space-x-16 space-y-72"
            />

            {
              pastedVideoUrl && (
                <XIcon className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white hover:text-red-400 cursor-pointer duration-150" onClick={() => setPastedVideoUrl("")} />
              )
            }

          </div>

          <button onClick={() => getFormats(pastedVideoUrl)} className="bg-teal-300 hover:bg-teal-400 text-white h-full  text-wrap font-bold py-2 px-4 z-40 cursor-pointer rounded uppercase  tracking-widest">
            Download
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
                              <p> {format.note} </p>
                              <p> {format.size} </p>
                            </div>
                            <button
                              className="w-full  py-2 px-4 md:w-auto border rounded-md bg-lime-800/10 flex items-center justify-center gap-2"
                              onClick={() =>
                                !singleVideoFormatData.isPlaylist
                                  ? download(singleVideoFormatData.url, format.format_id)
                                  : downloadPlaylist(singleVideoFormatData.url, Number(format.format_id))
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
