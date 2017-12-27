# Node Steam Card Farm
[![GitHub license](https://img.shields.io/github/license/gabrieldrs/node-steam-card-farm.svg?style=flat-square)](https://github.com/gabrieldrs/node-steam-card-farm/blob/master/LICENSE)
![Node version](https://img.shields.io/badge/node-%3E%3D%206.11.2-green.svg?style=flat-square)
## Description
This is a Steam Trading Cards Farming Machine powered by Node.js. 

The advantages of this in comparison with other solutions is that this can be easily containerized (container script included) and deployed anywhere, it's also highly customizable and easy to extend. Since this can be built into a docker image, it's possible to leave an trading card farming machine running in the cloud forever, without the need to have a personal device turned on all the time.

It's based on [Node Steam](https://github.com/seishun/node-steam), a library that interacts with Steam throught an API without running a steam client. Extensions were developed based on works from [Node Steam Weblogon](https://github.com/Alex7Kom/node-steam-weblogon) and [Node Steam Web API](https://github.com/seishun/node-steam-web-api)

## How to use it

When you run the project, it will create a small web application where you can type your credentials information. Go to `http://localhost:8080` and submit the required information.

Done. If you have typed your credentials correctly, it will start the idling process automatically in the background. You can check progress in the process window. 

## Dependencies

In order to run the project locally you will need [Docker](https://www.docker.com/) installed in you system. Very superficially, docker is a Command Line Interface in which you can create small and light Virtual Machines that isolate applications on predefined environments based on a script.

Since docker does all the work of setting up the environment, you won't need anything else to run the application.

If you want to build over it, you will need Node.js (v6.11.2), all other dependencies are listed in the package.json file:


## Running

After installing docker:
- Open a terminal/command line
- Navigate to the root folder of this project
- type `docker build -t sccf . && docker run -d sccf`

If it goes without issues, you will have a web application running on [http://localhost:8080](http://localhost:8080).

## Deploying to the cloud
TODO

## Continuous Improvement

There's still lots of improvements to be made, but perfect is the enemy of good, so I decided to have a first "as is" release and build over it based on feedback.

If you think you have found a bug, take a look at the Issues section to see if someone else has reported it, if it's something new, just open an issue and I will analyze, please, make sure to describe the required steps to reproduce it, otherwise I won't be able to help.

If you are having trouble with something else, feel free to contact me by [email](mailto:gabriel@sezefredo.com), I will be glad to help you out.