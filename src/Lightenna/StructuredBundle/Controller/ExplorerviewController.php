<?php

namespace Lightenna\StructuredBundle\Controller;

use Sensio\Bundle\FrameworkExtraBundle\Configuration\Route;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\Request;

use Lightenna\StructuredBundle\DependencyInjection\Constantly;

class ExplorerviewController extends ViewController
{

    /**
     * Opens a folder in the OS explorer view
     *
     * @Route("/explorer/", name="lightenna_explorer_root")
     * @Route("/explorer/{identifier}/", name="lightenna_explorer_id")
     * @Route("/explorer/{identifier}/index.html", name="lightenna_explorer_id")
     */
    public function indexAction($identifier = '/', $format = 'html', Request $req)
    {
        $this->request = $req;
        if ($identifier == '/') {
            return new Response('{ "status" : "ERROR", "message" : "Cannot request root folder" }');
        }
        // store rawname being indexed
        $this->rawname = $identifier;
        // convert rawname to urlname and filename
        $filename = $this->convertRawToFilename($this->rawname);
        // check server is running locally
        $running_on_localhost = ($_SERVER['SERVER_NAME'] == 'localhost');
        if ($running_on_localhost) {
            $safepath = realpath($filename);
            system("explorer " . escapeshellarg($safepath));
            return new Response('{ "status" : "OK" }');
        } else {
            return new Response('{ "status" : "ERROR", "message" : "Cannot request folder on remote server" }');
        }
    }

}


