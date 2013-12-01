<?php

namespace Lightenna\StructuredBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller;

class ImageviewController extends Controller
{
	public function indexAction($name)
	{
		return $this->render('LightennaStructuredBundle:Imageview:image.html.twig', array(
			'filename' => $name,
		));
	}

}
