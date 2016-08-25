<?php

namespace Lightenna\StructuredBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\ResponseHeaderBag;
use Symfony\Component\HttpFoundation\RedirectResponse;

use Lightenna\StructuredBundle\Entity\ImageMetadata;
use Lightenna\StructuredBundle\Entity\Arguments;
use Lightenna\StructuredBundle\DependencyInjection\LayerOuter;
use Lightenna\StructuredBundle\DependencyInjection\CachedMetadataFileReader;
use Lightenna\StructuredBundle\DependencyInjection\Constantly;

class FileviewController extends ViewController
{

    public function indexAction($rawname, $format = 'html', Request $req)
    {
        $this->request = $req;
        // store rawname being indexed
        $this->rawname = $rawname;
        // convert rawname to urlname and filename
        $filename = $this->convertRawToFilename($this->rawname);
        $name = self::convertRawToUrl($this->rawname);
        // create a file reader object to get directory/zip/directory-nested-in-zip listing
        $this->mfr = new CachedMetadataFileReader(null, $this);
        // Fileview listing is exposed in the view, so sort it
        $this->mfr->setSorted(true);
        $this->mfr->rewrite($filename);
        $this->mfr->injectShares($name);
        $this->mfr->processDebugSettings();
        // @todo remove these lines once we're sure everything works
        // $thumbargs = new Arguments(200,200);
        // $this->mfr->mergeArgs($thumbargs);
        // for now just display errors
        if ($this->errbuf !== null) {
            print(implode('', $this->getErrors()));
        }
        if ($this->mfr->isExisting()) {
            if ($this->mfr->isDirectory()) {
                // get the list of entries for this directory
                $listing = $this->mfr->getListing();
                $linkpath = $name == '/' ? '' : trim($name, Constantly::DIR_SEPARATOR_URL) . Constantly::DIR_SEPARATOR_URL;
                // check to see if we've only got a single entry
                if (count($listing) == 1) {
                    if (reset($listing)->isDirectory()) {
                        // if it's a directory, redirect to it immediately
                        return new RedirectResponse('/file/'. $linkpath . reset($listing)->getName() . Constantly::DIR_SEPARATOR_URL);
                    }
                }
                // ensure that we're reading/making up all the metadata (cached and uncached files)
                $this->mfr->getDirectoryAll($listing, false);
                $response = $this->render('LightennaStructuredBundle:Fileview:directory.html.twig', array(
                    'dirname' => $name,
                    'direction' => Constantly::DEFAULT_LAYOUT_DIRECTION,
                    'celltype' => 'pc',
                    'breadth' => Constantly::DEFAULT_LAYOUT_BREADTH,
                    'linkpath' => CachedMetadataFileReader::hash($linkpath),
                    'linkaliased' => str_replace(Constantly::DIR_SEPARATOR_URL, Constantly::DIR_SEPARATOR_ALIAS, trim($name, Constantly::DIR_SEPARATOR_URL)) . Constantly::DIR_SEPARATOR_ALIAS,
                    'dirsep' => Constantly::DIR_SEPARATOR_ALIAS,
                    'argsbase' => Constantly::ARG_SEPARATOR,
                    'dirlisting' => $listing,
                    'metaform' => $this->mfr->getMetadata()->getForm($this)->createView(),
                    'defaults' => ImageMetadata::getDefaults(),
                    // client-side settings
                    'settings' => $this->settings['client'],
                ));
                // tell cache this is a /file
                $file_cachedir = $this->mfr->setupCacheDir('file');
                // cache directory HTML content (part of response) and always update
                $content = $response->getContent();
                $this->mfr->cache($content, $file_cachedir . $name . Constantly::DIR_SEPARATOR_URL . Constantly::DIR_INDEX_FILENAME . '.' . Constantly::CACHE_FILEEXT, true);
                // could return the response directly
                // return $response;
                // redirect to ensure that future refreshes come from cache
                return new RedirectResponse(Constantly::DIR_SEPARATOR_URL . 'file' . $name . Constantly::DIR_SEPARATOR_URL . Constantly::DIR_INDEX_FILENAME);
            } else {
                // prepare BinaryFileResponse
                $realname = str_replace('/', '\\', $filename);
                $fileleaf = basename($filename);
                $response = new BinaryFileResponse($realname);
                $response->trustXSendfileTypeHeader();
                $response->setContentDisposition(
                    ResponseHeaderBag::DISPOSITION_INLINE,
                    $fileleaf,
                    iconv('UTF-8', 'ASCII//TRANSLIT', $fileleaf)
                );
                return $response;
            }
        } else {
            // implied else
            return $this->render('LightennaStructuredBundle:Fileview:file_not_found.html.twig');
        }
    }

}


