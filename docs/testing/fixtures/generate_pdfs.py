"""Generates the two self-authored PDF fixtures used for manual RAG/materials
testing (docs/testing/TEST-REPORT.md). Run once with `python3 generate_pdfs.py`;
the .pdf outputs are committed alongside this script so the test report's
findings are reproducible without re-running it.
"""
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.lib.units import inch

styles = getSampleStyleSheet()
title_style = ParagraphStyle("TitleX", parent=styles["Title"], spaceAfter=18)
h_style = ParagraphStyle("HeadingX", parent=styles["Heading1"], spaceAfter=12)
body_style = ParagraphStyle("BodyX", parent=styles["BodyText"], fontSize=11, leading=16, spaceAfter=10)


def build(path, title, pages):
    doc = SimpleDocTemplate(path, pagesize=LETTER, topMargin=1 * inch, bottomMargin=1 * inch)
    story = [Paragraph(title, title_style), Spacer(1, 12)]
    for i, (heading, paragraphs) in enumerate(pages):
        if i > 0:
            story.append(PageBreak())
        story.append(Paragraph(heading, h_style))
        for p in paragraphs:
            story.append(Paragraph(p, body_style))
    doc.build(story)
    print("wrote", path)


CELL_BIOLOGY_PAGES = [
    ("Introduction to Cell Biology", [
        "The cell is the smallest structural and functional unit of life. Every living organism, "
        "from a single bacterium to a human being, is composed of one or more cells. Cell biology "
        "studies the physical structure, chemical composition, and functional processes that occur "
        "within cells, as well as how cells interact with their environment and with each other.",
        "There are two broad categories of cells: prokaryotic cells, which lack a membrane-bound "
        "nucleus (found in bacteria and archaea), and eukaryotic cells, which possess a true nucleus "
        "and a variety of specialized internal compartments called organelles. This document focuses "
        "on eukaryotic cells, since they are the building blocks of plants, animals, and fungi.",
    ]),
    ("The Cell Membrane", [
        "The cell membrane, also called the plasma membrane, is a thin, flexible barrier that "
        "surrounds every cell and separates its internal contents from the external environment. "
        "It is composed primarily of a phospholipid bilayer: two layers of phospholipid molecules "
        "arranged so that their hydrophilic (water-loving) heads face outward and their hydrophobic "
        "(water-fearing) tails face inward, forming a stable barrier to most water-soluble substances.",
        "Embedded within the phospholipid bilayer are proteins that perform many critical jobs: "
        "channel proteins and carrier proteins regulate what enters and exits the cell, receptor "
        "proteins detect chemical signals from outside the cell, and some proteins anchor the "
        "cytoskeleton to the membrane. This selective permeability allows the cell to maintain a "
        "stable internal environment, a state known as homeostasis, even as conditions outside change.",
    ]),
    ("Mitochondria: The Powerhouse of the Cell", [
        "Mitochondria are membrane-bound organelles found in nearly all eukaryotic cells, and they "
        "are widely known as the powerhouse of the cell because they generate most of the cell's "
        "supply of adenosine triphosphate (ATP), the molecule cells use as their primary energy "
        "currency. Mitochondria have two membranes: a smooth outer membrane and a highly folded inner "
        "membrane whose folds are called cristae, which greatly increase the surface area available "
        "for energy-producing chemical reactions.",
        "The process by which mitochondria produce ATP is called cellular respiration, specifically "
        "the stages known as the citric acid cycle (Krebs cycle) and oxidative phosphorylation. During "
        "oxidative phosphorylation, mitochondria use oxygen to convert energy stored in glucose and "
        "fatty acids into ATP far more efficiently than would be possible without oxygen. Cells with "
        "high energy demands, such as muscle cells and neurons, typically contain especially large "
        "numbers of mitochondria to meet their metabolic needs.",
    ]),
    ("The Nucleus and DNA", [
        "The nucleus is the control center of a eukaryotic cell. It is enclosed by a double membrane "
        "called the nuclear envelope, which is perforated by nuclear pores that regulate the movement "
        "of molecules, such as RNA and proteins, into and out of the nucleus. Inside the nucleus, "
        "genetic material is organized as chromatin, a complex of DNA wound around proteins called "
        "histones, which condenses into visible chromosomes when a cell prepares to divide.",
        "DNA (deoxyribonucleic acid) stores the hereditary instructions used for the growth, "
        "development, and functioning of the organism. Segments of DNA called genes are transcribed "
        "into messenger RNA inside the nucleus; that RNA then travels to the cytoplasm, where it is "
        "translated by ribosomes into proteins. The nucleolus, a dense region within the nucleus, is "
        "responsible for producing the ribosomal RNA that ribosomes are built from.",
    ]),
    ("Cell Division: Mitosis", [
        "Mitosis is the process by which a single eukaryotic cell divides to produce two genetically "
        "identical daughter cells. It is essential for growth, tissue repair, and asexual reproduction "
        "in eukaryotes. Mitosis is traditionally described in four main phases: prophase, metaphase, "
        "anaphase, and telophase, which together ensure that each daughter cell receives a complete "
        "and accurate copy of the parent cell's chromosomes.",
        "During prophase, chromatin condenses into visible chromosomes and the mitotic spindle begins "
        "to form. In metaphase, chromosomes align along the cell's equatorial plane. In anaphase, "
        "sister chromatids are pulled apart toward opposite poles of the cell. Finally, in telophase, "
        "two new nuclear envelopes form around the separated chromosomes, and the cell proceeds to "
        "cytokinesis, physically splitting into two separate daughter cells.",
    ]),
]

NEWTONIAN_MECHANICS_PAGES = [
    ("Introduction to Newtonian Mechanics", [
        "Newtonian mechanics, also called classical mechanics, is the branch of physics that "
        "describes the motion of everyday objects, from thrown balls to orbiting planets, using the "
        "laws formulated by Sir Isaac Newton in his 1687 work Philosophiae Naturalis Principia "
        "Mathematica. It remains an excellent approximation for describing motion at speeds far "
        "slower than the speed of light and at scales far larger than atomic dimensions.",
        "At the heart of Newtonian mechanics are three laws of motion that relate the forces acting "
        "on an object to its resulting motion, along with the law of universal gravitation. Together, "
        "these laws allow us to predict how objects will move when we know the forces acting on them, "
        "forming the theoretical foundation for engineering disciplines such as mechanical and "
        "aerospace engineering.",
    ]),
    ("Newton's First Law: Inertia", [
        "Newton's First Law of Motion, often called the law of inertia, states that an object at "
        "rest will remain at rest, and an object in motion will continue moving at a constant "
        "velocity in a straight line, unless it is acted upon by a net external force. Inertia is "
        "the tendency of an object to resist changes in its state of motion, and it is directly "
        "related to the object's mass: the more massive an object is, the greater its inertia, and "
        "the more force is required to change its velocity.",
        "A classic illustration of the first law is a passenger in a car that suddenly brakes: the "
        "passenger's body tends to keep moving forward at the car's original speed because of "
        "inertia, which is why seatbelts are necessary to provide the external force that decelerates "
        "the passenger along with the vehicle. In the vacuum of space, far from any planet, a "
        "spacecraft with its engines off will continue traveling in a straight line at constant speed "
        "indefinitely, since no net external force acts to change its motion.",
    ]),
    ("Newton's Second Law: Force, Mass, and Acceleration", [
        "Newton's Second Law of Motion states that the acceleration of an object is directly "
        "proportional to the net force acting on it and inversely proportional to its mass. This is "
        "commonly written as the equation F = m * a, where F is the net force applied, m is the "
        "object's mass, and a is the resulting acceleration. This law quantifies exactly how much an "
        "object's motion will change in response to a given force.",
        "One important consequence of the second law is that if the mass of an object is doubled "
        "while the applied force stays the same, the resulting acceleration is cut in half; "
        "conversely, to produce the same acceleration on a heavier object, a proportionally larger "
        "force must be applied. This relationship explains everyday experiences, such as why it is "
        "harder to push a fully loaded shopping cart than an empty one, and why heavier vehicles "
        "generally require more powerful engines to achieve the same acceleration as lighter ones.",
    ]),
    ("Newton's Third Law: Action and Reaction", [
        "Newton's Third Law of Motion states that for every action, there is an equal and opposite "
        "reaction. In more precise terms, whenever one object exerts a force on a second object, the "
        "second object simultaneously exerts a force of equal magnitude and opposite direction back "
        "on the first object. These two forces always act on different objects, which is why they do "
        "not cancel each other out even though they are equal and opposite.",
        "A rocket launching into space is a direct application of the third law: the rocket engine "
        "pushes hot exhaust gases downward and backward with great force, and in reaction, those "
        "gases push the rocket upward and forward with an equal amount of force. Similarly, when a "
        "swimmer pushes water backward with their hands and legs, the water pushes the swimmer "
        "forward, propelling them through the pool.",
    ]),
    ("Applications of Newtonian Mechanics", [
        "The three laws of motion, combined with Newton's law of universal gravitation, allow "
        "engineers and scientists to predict the trajectories of projectiles, design stable "
        "structures capable of withstanding known forces, and calculate the orbits of satellites and "
        "planets with remarkable precision. Automotive safety engineers use these laws to design "
        "crumple zones and airbags that reduce the forces experienced by passengers during a "
        "collision, directly applying the relationship between force, mass, and acceleration.",
        "While Newtonian mechanics eventually gives way to Einstein's theory of relativity at speeds "
        "approaching the speed of light, and to quantum mechanics at the scale of atoms and "
        "subatomic particles, it remains the practical and sufficiently accurate framework for the "
        "vast majority of engineering and everyday physics problems, from calculating how far a "
        "thrown ball will travel to planning the trajectory of a spacecraft to the Moon.",
    ]),
]

if __name__ == "__main__":
    build("cell_biology.pdf", "Cell Biology: Structure and Function", CELL_BIOLOGY_PAGES)
    build("newtonian_mechanics.pdf", "Newtonian Mechanics: The Three Laws of Motion", NEWTONIAN_MECHANICS_PAGES)
